(function (global) {
  'use strict';

  var SEAT_POSITIONS = [
    { left: '50%',  top: '94%',  side: 'bottom' },  // 0: Hero bottom-center
    { left: '79%',  top: '80%',  side: 'bottom' },  // 1: bottom-right
    { left: '92%',  top: '48%',  side: 'right'  },  // 2: right
    { left: '79%',  top: '15%',  side: 'top'    },  // 3: top-right
    { left: '50%',  top: '4%',   side: 'top'    },  // 4: top-center
    { left: '21%',  top: '15%',  side: 'top'    },  // 5: top-left
    { left: '8%',   top: '48%',  side: 'left'   },  // 6: left
    { left: '21%',  top: '80%',  side: 'bottom' },  // 7: bottom-left
  ];

  var SEAT_MAPS = {
    2: [0, 4],
    3: [0, 3, 5],
    4: [0, 2, 4, 6],
    5: [0, 1, 4, 5, 7],
    6: [0, 1, 3, 4, 5, 7],
    7: [0, 1, 2, 4, 5, 6, 7],
    8: [0, 1, 2, 3, 4, 5, 6, 7],
  };

  function getVisibleSeatIndices(playerCount) {
    if (playerCount < 2) return [0];
    if (playerCount > 8) playerCount = 8;
    return SEAT_MAPS[playerCount] || SEAT_MAPS[8].slice(0, playerCount);
  }

  function getPositionForSeatIndex(seatIndex) {
    return SEAT_POSITIONS[seatIndex] || SEAT_POSITIONS[0];
  }

  function getSideForSeatIndex(seatIndex) {
    var pos = SEAT_POSITIONS[seatIndex] || SEAT_POSITIONS[0];
    return pos.side || 'bottom';
  }

  global.SEAT_POSITIONS = SEAT_POSITIONS;
  global.getVisibleSeatIndices = getVisibleSeatIndices;
  global.getPositionForSeatIndex = getPositionForSeatIndex;
  global.getSideForSeatIndex = getSideForSeatIndex;
})(typeof window !== 'undefined' ? window : this);
