#!/usr/bin/env node

import { EP2Key } from "./";

// import readline from "readline"

// Parse the command-line arguments
// const [, , arg1, arg2] = process.argv;

// Define a mapping of commands to functions
const commands: {
  [key: string]: ((arg?: any) => void) | (() => void);
} = {
  generate: () => {
    EP2Key.create().then((key) => console.info(key.toJSON()));
  },
  validate: async (json: string) => {
    try {
      const restored = await EP2Key.fromJson(json);
      const encrypted = restored.anonymize("ok", restored.id);
      const decrypted = encrypted.decrypt(restored, restored.id);
      const valid = decrypted === "ok";
      valid && console.info("Key Valid");
    } catch (error) {
      console.error("JSON does not contain valid EP2Key: ", error);
    }
  },
  unknown: (arg) => {
    console.error("Unknown command: " + arg);
  },
};

// Get the command to execute from the first argument
let command = process.argv[2];
let arg;
// If the command is not recognized, print usage information and exit
if (command !== undefined && command.trim().length > 0) {
  if (commands[command] === undefined) {
    arg = command;
    command = "unknown";
  }
  if (command === "validate") arg = process.argv[3];
} else {
  command = "generate";
}

// Execute the appropriate function for the command
command && commands[command]!(arg);
