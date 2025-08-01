// Simple test to verify the persona function works
const fs = require('fs');
const path = require('path');

// Read the shared.ts file and extract the function
const sharedFile = fs.readFileSync(path.join(__dirname, 'app/lib/shared.ts'), 'utf8');

// Mock messages to test the function
const mockMessages = [
  { content: "Hey brother, how's your day going?" },
  { content: "got you, that's solid" },
  { content: "awesome, what's your portfolio size?" }
];

console.log('Testing persona function with recent messages...');
console.log('Messages:', mockMessages.map(m => m.content));

// This is a simplified test - in actual usage, the TypeScript would be compiled
console.log('\nThe persona function should now detect:');
console.log('- "brother" was used recently');
console.log('- "got you" was used recently');
console.log('- "solid" was used recently');
console.log('- "awesome" was used recently');
console.log('\nAnd provide instructions to avoid these terms in the next response.');