#!/usr/bin/env node

/**
 * Global Installation Script for TaskPing claude-control
 * Makes claude-control.js accessible from any directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_NAME = 'claude-control';
const SOURCE_PATH = path.join(__dirname, 'claude-control.js');
const TARGET_DIR = '/usr/local/bin';
const TARGET_PATH = path.join(TARGET_DIR, SCRIPT_NAME);

function checkRequirements() {
    // Check if claude-control.js exists
    if (!fs.existsSync(SOURCE_PATH)) {
        console.error('❌ Error: claude-control.js not found in current directory');
        process.exit(1);
    }

    // Check if /usr/local/bin is writable
    try {
        fs.accessSync(TARGET_DIR, fs.constants.W_OK);
    } catch (error) {
        console.error('❌ Error: No write permission to /usr/local/bin');
        console.log('💡 Try running with sudo:');
        console.log('   sudo node install-global.js');
        process.exit(1);
    }
}

function createGlobalScript() {
    const scriptContent = `#!/usr/bin/env node

/**
 * Global Claude Control Wrapper
 * Executes claude-control.js from its original location
 */

const path = require('path');
const { spawn } = require('child_process');

// TaskPing installation directory
const TASKPING_DIR = '${__dirname}';
const CLAUDE_CONTROL_PATH = path.join(TASKPING_DIR, 'claude-control.js');

// Get command line arguments (excluding node and script name)
const args = process.argv.slice(2);

// Change to TaskPing directory before execution
process.chdir(TASKPING_DIR);

// Execute claude-control.js with original arguments
const child = spawn('node', [CLAUDE_CONTROL_PATH, ...args], {
    stdio: 'inherit',
    env: { ...process.env, TASKPING_HOME: TASKPING_DIR }
});

child.on('error', (error) => {
    console.error('Error executing claude-control:', error.message);
    process.exit(1);
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
    } else {
        process.exit(code || 0);
    }
});
`;

    return scriptContent;
}

function install() {
    console.log('🚀 Installing claude-control globally...\n');

    try {
        // Create the global script
        const scriptContent = createGlobalScript();
        fs.writeFileSync(TARGET_PATH, scriptContent);
        
        // Make it executable
        fs.chmodSync(TARGET_PATH, 0o755);
        
        console.log('✅ Installation completed successfully!');
        console.log(`📁 Installed to: ${TARGET_PATH}`);
        console.log('\n🎉 Usage:');
        console.log('   claude-control --session myproject');
        console.log('   claude-control --list');
        console.log('   claude-control --kill all');
        console.log('\nYou can now run claude-control from any directory!');
        
    } catch (error) {
        console.error('❌ Installation failed:', error.message);
        process.exit(1);
    }
}

function uninstall() {
    console.log('🗑️  Uninstalling claude-control...\n');
    
    try {
        if (fs.existsSync(TARGET_PATH)) {
            fs.unlinkSync(TARGET_PATH);
            console.log('✅ Uninstallation completed successfully!');
            console.log(`🗑️  Removed: ${TARGET_PATH}`);
        } else {
            console.log('⚠️  claude-control is not installed globally');
        }
    } catch (error) {
        console.error('❌ Uninstallation failed:', error.message);
        process.exit(1);
    }
}

function showHelp() {
    console.log('TaskPing Claude Control - Global Installation\n');
    console.log('Usage:');
    console.log('  node install-global.js [install]   - Install globally');
    console.log('  node install-global.js uninstall   - Uninstall');
    console.log('  node install-global.js --help      - Show this help\n');
    console.log('Requirements:');
    console.log('  - Write permission to /usr/local/bin (may need sudo)');
    console.log('  - claude-control.js must exist in current directory');
}

function main() {
    const command = process.argv[2];
    
    if (command === '--help' || command === '-h') {
        showHelp();
        return;
    }
    
    if (command === 'uninstall') {
        uninstall();
        return;
    }
    
    // Default action is install
    checkRequirements();
    install();
}

// Run only if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = { install, uninstall };