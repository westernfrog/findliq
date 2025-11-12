export async function POST(request) {
  const {
    lat,
    lng,
    searchTerm = "alcohol|wine|beverages",
  } = await request.json();

  try {
    const query = `
      [out:json];
      (
        node["shop"~"${searchTerm}"](around:5000,${lat},${lng});
        way["shop"~"${searchTerm}"](around:5000,${lat},${lng});
      );
      out center;
    `;

    const response = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
        query
      )}`
    );

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.elements || data.elements.length === 0) {
      return Response.json({ error: "No shops found nearby" }, { status: 404 });
    }

    const haversineDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const shops = data.elements
      .map((element) => ({
        lat: element.lat || element.center?.lat,
        lng: element.lon || element.center?.lon,
        name: element.tags?.name || "Unnamed Shop",
        address:
          element.tags?.["addr:full"] ||
          `${element.tags?.["addr:street"] || ""} ${
            element.tags?.["addr:housenumber"] || ""
          }`.trim() ||
          "Address not available",
        opening_hours: element.tags?.opening_hours || "Unknown",
        website: element.tags?.website || null,
        phone: element.tags?.phone || null,
      }))
      .filter((shop) => shop.lat && shop.lng);

    const nearest = shops.reduce((closest, shop) => {
      const distance = haversineDistance(lat, lng, shop.lat, shop.lng);
      return !closest || distance < closest.distance
        ? { ...shop, distance: Number(distance.toFixed(2)) }
        : closest;
    }, null);

    return Response.json(nearest);
  } catch (error) {
    console.error("Error fetching OSM data:", error);
    return Response.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
