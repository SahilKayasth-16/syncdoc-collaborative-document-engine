# SyncDoc Security Architecture

## 1. Security Objective

## 2. Trust Boundaries

## 3. Document Data Flow

## 4. User-Controlled Fields

## 5. Content Security Policy

## 6. Plain-Text AST Policy

## 7. Code Block Policy

## 8. AST Structural Validation

## 9. Recursive Node Processing

## 10. WebSocket / Yjs Security Boundary

## 11. MongoDB Persistence Boundary

## 12. Transformation / PDF Boundary

## 13. Frontend Rendering Boundary

## 14. XSS Attack Matrix

## 15. Known Security Limitations

## 16. Future Rich-Text Policy

# Attack Matrix:

| Payload                                   | Expected behavior                 |
| ----------------------------------------- | --------------------------------- |
| `<script>alert("XSS")</script>`           | Not executable                    |
| `<img src=x onerror=alert(1)>`            | Event handler rejected            |
| `<a href="javascript:alert(1)">Click</a>` | `javascript:` rejected            |
| `<div onclick="alert(1)">Test</div>`      | Event handler rejected            |
| `<iframe src="...">`                      | Not allowed                       |
| Nested malicious HTML                     | Sanitized recursively             |
| Malicious code-block content              | Preserved as text, never executed |
