// Appliance library. Watts are the top of the nameplate range in the U.S. DOE
// "typical wattages" list (as reproduced in Penn State EGEE 102, appliance_table.pdf),
// unless noted. People should use the number on their own label.
export const LIBRARY = [
  { key: 'heater', name: 'Space heater', watts: 1500, lowWatts: 750, kind: 'heater', note: 'DOE portable heater range 750-1500 W' },
  { key: 'oilheater', name: 'Oil-filled radiator', watts: 1500, lowWatts: 900, kind: 'heater', note: 'Common 600/900/1500 W settings' },
  { key: 'hairdryer', name: 'Hair dryer', watts: 1500, kind: 'appliance', note: 'DOE range 1200-1875 W; check your label' },
  { key: 'kettle', name: 'Electric kettle', watts: 1500, kind: 'appliance', note: 'Typical U.S. kettle label' },
  { key: 'microwave', name: 'Microwave', watts: 1100, kind: 'appliance', note: 'DOE range 750-1100 W' },
  { key: 'toaster', name: 'Toaster', watts: 1400, kind: 'appliance', note: 'DOE range 800-1400 W' },
  { key: 'coffee', name: 'Coffee maker', watts: 1200, kind: 'appliance', note: 'DOE range 900-1200 W' },
  { key: 'iron', name: 'Clothes iron', watts: 1800, kind: 'appliance', note: 'DOE range 1000-1800 W' },
  { key: 'vacuum', name: 'Vacuum', watts: 1440, kind: 'appliance', note: 'DOE range 1000-1440 W' },
  { key: 'fridge', name: 'Mini fridge', watts: 150, kind: 'appliance', note: 'Running watts' },
  { key: 'laptop', name: 'Laptop', watts: 90, kind: 'small', note: 'Charger rating' },
  { key: 'monitor', name: 'Monitor', watts: 40, kind: 'small', note: '' },
  { key: 'desktop', name: 'Gaming PC', watts: 500, kind: 'small', note: 'Power supply under load' },
  { key: 'tv', name: 'TV', watts: 150, kind: 'small', note: '' },
  { key: 'console', name: 'Game console', watts: 200, kind: 'small', note: '' },
  { key: 'lamp', name: 'Lamp', watts: 10, kind: 'small', note: 'LED' },
  { key: 'phone', name: 'Phone charger', watts: 20, kind: 'small', note: '' },
  { key: 'blanket', name: 'Electric blanket', watts: 200, kind: 'small', note: '' },
];

// Sample: a one-bedroom apartment in an older building. Example data, not a real home.
export function sampleHome() {
  return {
    name: 'Sample 1-bedroom apartment',
    circuits: [
      { id: 'b3', label: 'Breaker 3', amps: 15 },
      { id: 'b5', label: 'Breaker 5', amps: 20 },
      { id: 'b6', label: 'Breaker 6', amps: 15 },
      { id: 'b8', label: 'Breaker 8', amps: 20 },
      { id: 'b10', label: 'Breaker 10', amps: 20 },
    ],
    outlets: [
      { id: 'bed', name: 'Bedside', room: 'Bedroom', circuitId: 'b3' },
      { id: 'desk', name: 'Desk', room: 'Bedroom', circuitId: 'b3' },
      { id: 'win', name: 'Window wall', room: 'Bedroom', circuitId: 'b5' },
      { id: 'hall', name: 'Hallway', room: 'Hallway', circuitId: 'b3' },
      { id: 'sofa', name: 'Sofa', room: 'Living room', circuitId: 'b5' },
      { id: 'tvwall', name: 'TV wall', room: 'Living room', circuitId: 'b6' },
      { id: 'kl', name: 'Counter left', room: 'Kitchen', circuitId: 'b8' },
      { id: 'kr', name: 'Counter right', room: 'Kitchen', circuitId: 'b10' },
    ],
    devices: [
      { id: 'd1', name: 'Bedroom heater', watts: 1500, lowWatts: 750, kind: 'heater', outletId: 'desk', strip: true, when: ['morning', 'evening'], movable: true },
      { id: 'd2', name: 'Hair dryer', watts: 1500, kind: 'appliance', outletId: 'desk', strip: false, when: ['morning'], movable: false },
      { id: 'd3', name: 'Laptop', watts: 90, kind: 'small', outletId: 'desk', strip: true, when: ['evening'], movable: false },
      { id: 'd4', name: 'Monitor', watts: 40, kind: 'small', outletId: 'desk', strip: true, when: ['evening'], movable: false },
      { id: 'd5', name: 'Phone charger', watts: 20, kind: 'small', outletId: 'bed', strip: false, when: ['evening'], movable: false },
      { id: 'd6', name: 'Living room heater', watts: 1500, lowWatts: 750, kind: 'heater', outletId: 'sofa', strip: false, when: ['evening'], movable: true },
      { id: 'd7', name: 'TV', watts: 150, kind: 'small', outletId: 'tvwall', strip: true, when: ['evening'], movable: false },
      { id: 'd8', name: 'Game console', watts: 200, kind: 'small', outletId: 'tvwall', strip: true, when: ['evening'], movable: false },
      { id: 'd9', name: 'Electric kettle', watts: 1500, kind: 'appliance', outletId: 'kl', strip: false, when: ['morning'], movable: true },
      { id: 'd10', name: 'Microwave', watts: 1100, kind: 'appliance', outletId: 'kl', strip: false, when: ['morning'], movable: false },
      { id: 'd11', name: 'Mini fridge', watts: 150, kind: 'appliance', outletId: 'kr', strip: false, when: ['morning', 'evening'], movable: false },
    ],
  };
}

export function emptyHome() {
  return { name: 'My place', circuits: [], outlets: [], devices: [] };
}
