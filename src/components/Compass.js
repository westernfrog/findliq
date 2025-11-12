"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export default function Compass() {
  const [userLocation, setUserLocation] = useState(null);
  const [targetLocation, setTargetLocation] = useState(null);
  const [bearing, setBearing] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [needleRotation, setNeedleRotation] = useState(0);
  const [isFinding, setIsFinding] = useState(true);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [error, setError] = useState(null);

  const accumulatedRotation = useRef(0);
  const lastTargetAngle = useRef(0);

  const findNearestShop = useCallback(async (location) => {
    try {
      const response = await fetch("/api/nearest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });

      if (response.ok) {
        const shop = await response.json();
        setTargetLocation(shop);
        setIsFinding(false);
      } else {
        setTimeout(() => findNearestShop(location), 5000);
      }
    } catch (err) {
      setError("Failed to find shops");
      setIsFinding(false);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setIsFinding(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(newLocation);
        if (isFinding) {
          findNearestShop(newLocation);
        }
      },
      (err) => {
        setError("Location access denied");
        setIsFinding(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isFinding, findNearestShop]);

  useEffect(() => {
    const handleOrientation = (event) => {
      if (event.webkitCompassHeading) {
        setDeviceHeading(event.webkitCompassHeading);
      } else if (event.alpha !== null) {
        setDeviceHeading(360 - event.alpha);
      }
    };

    const requestOrientationPermission = async () => {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        setNeedsPermission(true);
      } else {
        window.addEventListener("deviceorientation", handleOrientation);
      }
    };

    requestOrientationPermission();

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  const handlePermissionRequest = async () => {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission === "granted") {
        setNeedsPermission(false);
        const handleOrientation = (event) => {
          if (event.webkitCompassHeading) {
            setDeviceHeading(event.webkitCompassHeading);
          } else if (event.alpha !== null) {
            setDeviceHeading(360 - event.alpha);
          }
        };
        window.addEventListener("deviceorientation", handleOrientation);
      } else {
        setError("Device orientation permission denied");
        setIsFinding(false);
      }
    } catch (err) {
      setError("Failed to request orientation permission");
      setIsFinding(false);
    }
  };

  useEffect(() => {
    if (userLocation && targetLocation) {
      const calculateBearing = () => {
        const lat1 = (userLocation.lat * Math.PI) / 180;
        const lon1 = (userLocation.lng * Math.PI) / 180;
        const lat2 = (targetLocation.lat * Math.PI) / 180;
        const lon2 = (targetLocation.lng * Math.PI) / 180;

        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x =
          Math.cos(lat1) * Math.sin(lat2) -
          Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        const bearing = (Math.atan2(y, x) * 180) / Math.PI;
        setBearing((bearing) % 360);
      };
      calculateBearing();
    }
  }, [userLocation, targetLocation]);

  useEffect(() => {
    if (!isFinding) {
      const targetAngle = (bearing - deviceHeading +90) % 360;

      let diff = targetAngle - (lastTargetAngle.current % 360);

      if (diff > 180) {
        diff -= 360;
      } else if (diff < -180) {
        diff += 360;
      }

      accumulatedRotation.current += diff;
      lastTargetAngle.current = targetAngle;

      setNeedleRotation(accumulatedRotation.current);
    }
  }, [bearing, deviceHeading, isFinding]);

  const calculateDistance = useCallback(() => {
    if (!userLocation || !targetLocation) return null;

    const R = 6371;
    const lat1 = (userLocation.lat * Math.PI) / 180;
    const lon1 = (userLocation.lng * Math.PI) / 180;
    const lat2 = (targetLocation.lat * Math.PI) / 180;
    const lon2 = (targetLocation.lng * Math.PI) / 180;

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }, [userLocation, targetLocation]);

  if (needsPermission) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Enable Compass</h2>
          <p className="text-gray-600 mb-6">
            This app needs access to your device's compass to point you to the nearest liquor shop.
          </p>
          <button
            onClick={handlePermissionRequest}
            className="permission-button"
          >
            Enable Compass
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-amber-50 to-amber-100">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <p className="text-red-600 text-lg font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const distance = calculateDistance();

  return (
    <div
      className={`h-screen grid grid-cols-12 gap-6 pt-16 ${
        isFinding ? "grayscale" : ""
      }`}
    >
      <div className="compass col-span-12 flex items-center justify-center">
        <div className="body">
          <div className="take">
            <div className="ring"></div>
          </div>
          <div className="panel">
            <div className="hold-bg">
              <div className="glass"></div>
              <div className="hold-mark">
                {[...Array(6)].map((_, i) => (
                  <div key={i}>
                    {[...Array(4)].map((_, j) => (
                      <span key={j}></span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="hold-arrows">
                <div className="arrow arrow-up"></div>
                <div className="arrow arrow-right"></div>
                <div className="arrow arrow-down"></div>
                <div className="arrow arrow-left"></div>
                <div className="arrow-sub arrow-up-right"></div>
                <div className="arrow-sub arrow-up-left"></div>
                <div className="arrow-sub arrow-down-right"></div>
                <div className="arrow-sub arrow-down-left"></div>
              </div>
              <div className="hold-directions">
                <div className="direction direction-n">N</div>
                <div className="direction direction-l">E</div>
                <div className="direction direction-s">S</div>
                <div className="direction direction-o">W</div>
                <div className="direction-sub direction-ne">NE</div>
                <div className="direction-sub direction-no">NW</div>
                <div className="direction-sub direction-se">SE</div>
                <div className="direction-sub direction-so">SW</div>
              </div>
            </div>
            <div
              className="hold-main-arrow"
              style={{
                transform: `rotate(${needleRotation}deg)`,
                animation: isFinding ? "spin 1s linear infinite" : "none",
                transition: isFinding ? "none" : "transform 0.3s ease-out",
              }}
            >
              <div className="main-arrow"></div>
              <div className="main-arrow down"></div>
            </div>
            <div className="center"></div>
          </div>
        </div>
      </div>
      {targetLocation && !isFinding && (
        <div className="col-span-12 flex flex-col items-center justify-start">
          <p className="location-name">{targetLocation.name}</p>
          {distance && (
            <p className="location-distance">
              <span className="distance-label">Distance:</span>
              <span className="distance-value">{distance}</span>
            </p>
          )}
        </div>
      )}
      {isFinding && (
        <div className="col-span-12 flex flex-col items-center justify-start">
          <p className="location-name">Finding Liquor...</p>
          <p className="location-distance">
            <span className="distance-label">
              It&apos;s{" "}
              {new Date().toLocaleDateString(undefined, { weekday: "long" })}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
