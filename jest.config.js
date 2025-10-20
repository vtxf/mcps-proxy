module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/src", "<rootDir>/tests"],
    testMatch: [
        "**/__tests__/**/*.ts",
        "**/?(*.)+(spec|test).ts"
    ],
    transform: {
        "^.+\\.ts$": "ts-jest",
    },
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/*.d.ts",
        "!src/**/index.ts",
    ],
    coverageDirectory: "coverage",
    coverageReporters: [
        "text",
        "lcov",
        "html"
    ],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^@/core/(.*)$": "<rootDir>/src/core/$1",
        "^@/types/(.*)$": "<rootDir>/src/types/$1",
        "^@/utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@/interfaces/(.*)$": "<rootDir>/src/interfaces/$1",
    },
    setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
    testTimeout: 30000,
};