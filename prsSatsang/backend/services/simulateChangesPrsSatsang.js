const simulateChange = (satsang) => {
const changes = {
...satsang,
lastUpdated: new Date().toISOString(),
attendance: Math.floor(Math.random() * 100) + 1
};
return changes;
};

exports.simulateSatsangChanges = (existingSatsangs) => {
return existingSatsangs.map(simulateChange);
};
