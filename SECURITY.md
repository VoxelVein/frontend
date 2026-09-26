# Security Policy

## Supported Versions

VoxelVein is currently under active development.

Security fixes are primarily applied to the latest version of the `main`
branch and the currently deployed production version.

| Version / Branch | Supported |
| ---------------- | --------- |
| `main`           | Yes       |
| `prod`           | Yes       |
| Older versions   | No        |

Because VoxelVein is actively evolving, older releases or commits may not
receive security fixes.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub
issues, pull requests, or discussions.**

Public disclosure before a vulnerability has been investigated and
addressed can put users, contributors, and the project at unnecessary risk.

You can report a vulnerability using GitHub's **private vulnerability
reporting** functionality for this repository, when available. You can also
contact us by opening a private ticket on our Discord server.

When submitting a report, please include as much of the following
information as possible:

* A clear description of the vulnerability
* The affected component, route, feature, or dependency
* The affected version, branch, or commit
* Steps to reproduce the issue
* A proof of concept, if available
* The potential security impact
* Any suggested mitigation or fix

Please avoid including real user data, credentials, authentication tokens,
database credentials, or other sensitive information in the report.

## What to Expect

After submitting a vulnerability report:

1. The maintainers will review the report.
2. The report will be investigated and its severity assessed.
3. Additional information may be requested if necessary.
4. The maintainers will work on an appropriate fix or mitigation.
5. Once the vulnerability has been addressed, disclosure may be coordinated
   with the reporter.

Response and remediation times may vary depending on the severity and
complexity of the vulnerability.

## Security Scope

Security reports may include, but are not limited to:

* Authentication and authorization vulnerabilities
* Session-management issues
* Account takeover vulnerabilities
* Injection vulnerabilities
* Cross-site scripting (XSS)
* Cross-site request forgery (CSRF)
* Server-side request forgery (SSRF)
* Sensitive information disclosure
* Insecure database access
* Privilege escalation
* Security issues in server-side application logic
* Vulnerable dependencies that directly affect VoxelVein
* Improper handling of secrets or credentials

## Out of Scope

The following generally do not constitute security vulnerabilities in
VoxelVein:

* Issues affecting unsupported or obsolete software versions
* Vulnerabilities in third-party services that cannot be influenced by
  VoxelVein
* Reports that require physical access to a user's device
* Social engineering attacks against VoxelVein contributors or users
* Denial-of-service reports without a demonstrated security impact
* Automated scanner output without a reproducible security impact
* Vulnerabilities that have already been publicly disclosed and addressed
* Theoretical vulnerabilities without a realistic attack scenario

This does not prevent maintainers from investigating a report that falls
outside these guidelines when appropriate.

## Responsible Disclosure

Please give the maintainers a reasonable opportunity to investigate and
address a reported vulnerability before publicly disclosing it.

Do not use a vulnerability to access, modify, delete, or exfiltrate data
belonging to other users.

Security research should be conducted in a way that minimizes disruption to
VoxelVein and its users.

## Security Updates

Security fixes may be released independently of normal feature development.

Depending on the severity of an issue, maintainers may:

* Release a security patch
* Update affected dependencies
* Rotate compromised credentials or secrets
* Disable an affected feature temporarily
* Publish a security advisory
* Notify affected users when appropriate

## Thank You

Responsible security research helps keep VoxelVein and its users safe.

Thank you for taking the time to report vulnerabilities responsibly and for
helping improve the security of the project.
