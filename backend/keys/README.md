# RSA Key Pair for JWT Signing

Generate keys using:

```bash
ssh-keygen -t rsa -b 2048 -m PEM -f private.pem
openssl rsa -in private.pem -pubout -outform PEM -out public.pem
```

Copy the public.pem to ../../gate/keys/public.pem (this will be used to validated the tokens on gate).
