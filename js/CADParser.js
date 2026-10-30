// [FILE] js/CADParser.js
// [CÔNG DỤNG] Xử lý chuỗi nhập lệnh CAD (Command Parsing) & Tính toán toạ độ
// [PHẠM VI] Thuần túy logic, không phụ thuộc DOM/Canvas

export const CAD_UTILS = {
  // Parse command input: "5", "@2,5", "L", "C", "5<30"
  parseInput: (str, lastPt) => {
    if (!str) return null;
    str = str.trim().toUpperCase();

    if(str.startsWith('@')&&!/^@-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?|<-?\d+(?:\.\d+)?)$/.test(str))return null;
    if(str.includes(',')&&!/^@?-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(str))return null;
    if(str.includes('<')&&!/^@?-?\d+(?:\.\d+)?<-?\d+(?:\.\d+)?$/.test(str))return null;
    // 1. Direct Distance (Number)
    // Regex: Optional negative sign, digits, optional decimal part
    if (/^-?\d+(\.\d+)?$/.test(str)) {
      return { type: "DIST", val: parseFloat(str) };
    }

    // 2. Relative/Polar with @
    if (str.startsWith("@")) {
      const remaining = str.substring(1);
      // Polar (@dist<angle)
      if (remaining.includes("<")) {
        const parts = remaining.split("<");
        return {
          type: "POLAR",
          dist: parseFloat(parts[0]),
          angle: parseFloat(parts[1]),
        };
      }
      // Cartesian (@x,y)
      const parts = remaining.split(",");
      if (parts.length === 2) {
        return {
          type: "REL_COORD",
          x: parseFloat(parts[0]),
          y: parseFloat(parts[1]),
        };
      }
    }

    // 3. Polar without @ (treat as relative by default for < format)
    // Example: "5<30" -> 5m at 30 degrees
    if (str.includes("<")) {
      const parts = str.split("<");
      if (parts.length === 2 && !isNaN(parseFloat(parts[0]))) {
        return {
          type: "POLAR",
          dist: parseFloat(parts[0]),
          angle: parseFloat(parts[1]),
        };
      }
    }

    // 4. Absolute Coords (x,y)
    // Must contain comma, not start with @
    if (str.includes(",") && !str.startsWith("@")) {
      const parts = str.split(",");
      return {
        type: "ABS_COORD",
        x: parseFloat(parts[0]),
        y: parseFloat(parts[1]),
      };
    }

    // 5. Commands (Character codes)
    return { type: "CMD", val: str };
  },

  // Calculate destination from dist/angle
  calcDest: (start, dist, angleDeg) => {
    const rad = angleDeg * (Math.PI / 180);
    return {
      x: start.x + dist * Math.cos(rad),
      y: start.y + dist * Math.sin(rad),
    };
  },
};

