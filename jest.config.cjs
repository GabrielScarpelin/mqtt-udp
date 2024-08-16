module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": "babel-jest",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!mqtt-udp/.*)", // Inclua aqui se precisar processar módulos específicos
  ],
  extensionsToTreatAsEsm: [".ts"],
};
