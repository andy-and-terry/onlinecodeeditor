// hello-world.js – Mini Scratch starter
// This file runs in your browser's console pane.
// Open the Console tab on the right to see output.

console.log('Hello, World! 👋');
console.log('Edit this file and click Run or switch to the Console tab.');

// Simple function example
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet('Mini Scratch'));

// Array example
const fruits = ['🍎 Apple', '🍌 Banana', '🍊 Orange'];
fruits.forEach((fruit, i) => {
  console.log(`${i + 1}. ${fruit}`);
});
