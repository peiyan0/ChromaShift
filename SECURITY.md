# Security and Privacy Policy

At ChromaShift, we treat accessibility data as sensitive health information. Because users may input visually sensitive corporate charts or personal documents, and calibrate models based on their specific Color Vision Deficiency (CVD) diagnosis, our architecture is designed around data minimization, strict expiration, and isolation.

## 1. Data Minimization & Retention

We do not want your data. We only keep it long enough to process it and allow you to download the results.

- **7-Day Auto-Expiry:** All uploaded media (images, videos, PDFs) and their processed counterparts are automatically permanently deleted from our storage backend after 7 days. A cleanup task prunes orphaned files by scanning for jobs older than the expiry threshold.
- **Immediate Purge:** Users can manually delete their jobs from the Media Hub, which instantly executes a hard delete in both the database and the S3-compatible storage.
- **Anonymous Calibration:** Vision profiles track mathematical transformation variables (contrast, severity matrices). We do not require or ask for your formal medical diagnosis.

## 2. Authentication & Authorization

- **JWT Tokens:** We use JSON Web Tokens (JWT) for all API authentication. Tokens are signed with a secret key using HS256.
- **Session Isolation:** Media jobs are strictly bound to the `user_id` of the account that created them. Every query that retrieves or modifies a media job enforces `WHERE user_id = <authenticated_user_id>`, making it impossible to access another user's files or compliance reports.
- **Guest Accounts:** Guest users receive a randomly generated UUID as a password (never user-chosen, never stored in plaintext) and a randomly generated email address scoped to `@chromashift.guest`. Guest accounts older than 24 hours and all associated files are automatically removed.

## 3. File Upload Security

All uploaded files pass the following validation before being accepted:

- **MIME Type Allowlist:** Only `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`, and `application/pdf` are accepted.
- **Magic Byte Verification:** The file's binary signature (magic bytes) is checked against the declared MIME type to prevent content-type spoofing. A JPEG that does not start with `\xFF\xD8`, a PNG without `\x89PNG`, or a PDF without `%PDF` is rejected regardless of the declared type.
- **Size Limits:** Images are capped at 50 MB, PDFs at 100 MB, and videos at 500 MB. Videos are additionally limited to 10 minutes in duration.

## 4. Infrastructure & Processing

- **Client-Side Previews:** Whenever possible — such as during calibration and live image preview — the YOLO26n-seg segmentation model runs entirely in the browser via ONNX Runtime Web (WebAssembly execution provider). The visual data never leaves the user's device during the adjustment phase.
- **Server-Side Operations:** Heavy-duty tasks (PDF parsing, video frame processing, WCAG compliance analysis) are offloaded to the backend. These processes are fully automated; no human ever views the media being processed.
- **Container Security:** The backend infrastructure is scanned for known CVEs using Trivy on every push to the `main` branch, targeting OS-level and library-level vulnerabilities of CRITICAL and HIGH severity.

## 5. Reporting Vulnerabilities

If you discover a security vulnerability within ChromaShift, please report it privately via [GitHub Security Advisory](https://github.com/peiyan0/ChromaShift/security/advisories). All security vulnerabilities will be promptly addressed.