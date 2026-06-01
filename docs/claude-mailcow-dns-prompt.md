# Claude Prompt: Finish SovetyDoma Mailcow DNS

Use this prompt in Claude/Chrome when logged into reg.ru.

```text
You are helping finish email setup for 1001sovet.ru.

Context:
- Website hosting must stay unchanged: 1001sovet.ru is live on Timeweb VPS 188.225.86.238.
- Do NOT edit or delete existing A records for @, www, or api.
- Mailboxes are already created in Mailcow on Hetzner.
- Public mail server hostname is mail.filippmiller.com.
- Goal: add DNS records so addresses like admin@1001sovet.ru and peter.ivanov@1001sovet.ru can receive mail.

Go to reg.ru DNS management for 1001sovet.ru and add these records:

1. MX
Host/name: @
Priority: 10
Value/target: mail.filippmiller.com.

2. TXT SPF
Host/name: @
Value:
v=spf1 mx ip4:89.167.42.128 ~all

3. TXT DMARC
Host/name: _dmarc
Value:
v=DMARC1; p=none; rua=mailto:dmarc@1001sovet.ru; ruf=mailto:dmarc@1001sovet.ru; fo=1

4. TXT DKIM
Host/name: dkim._domainkey
Value:
v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt4Phb2KEQ31ZbkXZ+8cG9YCnRMEX8ChxfWPWR2oQVlSJuy34nqoZT9/ExDKCk7C7smFj+wVA8cw7dGQKVUBFtXFxeCTYskpmYIp4N5QfPGtFoj+5dUGcpEnwh7JYCAbEVfWiJgPapsLA33zb12FymZW8kjq3BeXzR3NE2BnMOJFPiKiA6GeyPR8PAWWu+9IjnMcD+BQ29Z9dPLGDn9vadnOUelsm+AIF4Kv+Q4A93QU2bkGT+eFtaZSPkbQazLsVc+enuVSQCUZ84GZKxoOPSjniynoJmU5648Aw7ZotWQeWTXE4an1St/r9W6AZ4UEhrF0j7xArDeKBoQuGJvKGMQIDAQAB

If reg.ru requires long TXT values split into chunks, split the DKIM value exactly as DNS TXT chunks under the same dkim._domainkey record; do not change the characters.

After saving, verify:
- MX lookup for 1001sovet.ru returns mail.filippmiller.com priority 10.
- TXT lookup for 1001sovet.ru includes the SPF record above.
- TXT lookup for _dmarc.1001sovet.ru includes the DMARC record above.
- TXT lookup for dkim._domainkey.1001sovet.ru includes the DKIM public key above.

Do not touch website DNS records. Do not create mail.1001sovet.ru unless explicitly asked later. IMAP/SMTP settings for users are:
- Webmail: https://mail.filippmiller.com/
- IMAP host: mail.filippmiller.com, port 993 SSL
- SMTP host: mail.filippmiller.com, port 587 STARTTLS
```
