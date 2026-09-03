import assert from "node:assert/strict";
import { sanitizePlainText } from "../src/security/sanitizer.js";

const testCases = [
    {
        name: "Script tag should be removed.",
        input: '<script>alert("XSS")</script>Hello',
        expected: "Hello"
    },
    {
        name: "Image on error XSS should be removed.",
        input: '<img src=x onerror=(1)>Test',
        expected: "Test"
    },
    {
        name: "javascript URL should be removed.",
        input: '<a href="javascript:alert(1)">Click</a>',
        expected: "Click"
    },
    {
        name: "Event handler should be removed.",
        input: '<div onclick="alert(1)">Test</div>',
        expected: "Test"
    },
    {
        name: "Normal paragraph should remain unchanged.",
        input: "Normal paragraph",
        expected: "Normal paragraph"
    },
    {
        name: "Code content should be treated as plain-text.",
        input: 'console.log("<b>Hello</b>")',
        expected: 'console.log("Hello")'
    }
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
    try {
        const actual = sanitizePlainText(testCase.input);

        assert.equal(actual, testCase.expected, `Epxected "${testCases.expected}" but received ${actual}.`);

        console.log(`✔️ ${testCase.name}`);

        passed++;
    } catch(error) {
        console.error(`X ${testCase.name}`);

        console.error(` ${error.message}\n`);
        
        failed++;
    }
}

console.log("\n===============");
console.log("Edge case tests");
console.log("===============\n");

const edgeCases = [
    {
        name: "Null should be handled safely.",
        input: null,
        expected: ""
    },
    {
        name: "Undefined should be handled safely.",
        input: undefined,
        expected: ""
    },
    {
        name: "Empty String should be handled safely.",
        input: "",
        expected: ""
    },
    {
        name: "Plain text should remain unchanged.",
        input: "Hello Syncdoc",
        expected: "Hello Syncdoc"
    },
    {
        name: "Nested script payload should be removed.",
        input: "<div><span><script>alert(1)</script>Hello</span></div>",
        expected: "Hello"
    },
    {
        name: "SVG XSS should be completely removed.",
        input: '<svg onload="alert(1)">Test</svg>',
        expected: ""
    },
    {
        name: "Style payload should be removed.",
        input: '<div style="background:url(javascript:alert(1))">Test</div>',
        expected: "Test"
    },
    {
        name: "Multiple malicious fragments should be removed.",
        input: '<script>alert(1)</script>Hello<img src=x onerror=alert(2)>World',
        expected: "HelloWorld"
    },
];

for (const testCase of edgeCases) {
    try {
        const actual = sanitizePlainText(testCase.input);

        assert.equal(actual, testCase.expected, `Expected "${testCase.expected}" but received "${actual}".`);

        console.log(`✔️ ${testCase.name}`);

        passed++;
    } catch(error) {
        console.error(`X ${testCase.name}`);

        console.error(` ${error.message}`);

        failed++;
    }
}

console.log("\n===============");
console.log("Sanitizer Test Summary.");
console.log("===============");

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
    console.error("\n Result: Fail");
    process.exit(1);
}

console.log("\n Result: Pass");