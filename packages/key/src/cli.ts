#!/usr/bin/env node

import EP2Key from "./";

// Parse the command-line arguments
// const [, , arg1, arg2] = process.argv;

// Define a mapping of commands to functions
const commands: {
  [key: string]: (() => void) | (() => Promise<void>);
} = {
  generate: async () => {
    console.log((await EP2Key.create()).toJSON());
  },
  action2: () => {},
};

// Get the command to execute from the first argument
let command = process.argv[2];

// If the command is not recognized, print usage information and exit
if (command !== undefined) {
  if (commands[command] === undefined) {
    console.error(`Usage: ${process.argv[1]} [command] [args]`);
    console.error("Available commands: action1, action2");
    process.exit(1);
  }
} else {
  command = "generate";
}

// Execute the appropriate function for the command
commands[command]!();
