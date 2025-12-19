# RSA Key Pair for JWT Signing

Generate keys using:

```bash
ssh-keygen -t rsa -b 2048 -m PEM -f private.pem
openssl rsa -in private.pem -pubout -outform PEM -out public.pem
```
