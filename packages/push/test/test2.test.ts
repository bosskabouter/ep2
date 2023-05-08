test("should first", async () => {
  interface Person {
    name: string;
    age?: number;
  }

  const person: Person = {
    name: "John Doe",
    age: 30,
  };

  const defaultPerson: Person = {
    name: "Anonymous",
    age: 18,
  };

  function greet(person: Person = defaultPerson) {
    console.log(`Hello, ${person.name}! You are ${person.age} years old.`);
  }

  greet(); // Output: Hello, Anonymous! You are 18 years old.
  greet(person); // Output: Hello, John Doe! You are 30 years old.
});
