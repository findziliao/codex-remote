#!/usr/bin/env node

const ConfigManager = require('./src/config-manager');

const manager = new ConfigManager();
manager.interactiveMenu().catch(console.error);