#!/bin/sh

set -ex

echo '
[ca]
default_ca = CA_default

[CA_default]
serial = ./serial.txt
database = ./index.txt
new_certs_dir = ./newcerts
default_md = default
name_opt = ca_default
cert_opt = ca_default
copy_extensions = copy  # Copy subjectAltName from CSR.

[policy_anything]
commonName = supplied
countryName = optional
emailAddress = optional
localityName = optional
organizationName = optional
organizationalUnitName = optional
stateOrProvinceName = optional
' > openssl-ca.conf

echo '
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req

[req_distinguished_name]
countryName = Country Name (2 letter code)
countryName_default = US
stateOrProvinceName = State or Province Name (full name)
stateOrProvinceName_default = California
localityName = Locality Name (eg, city)
localityName_default = San Francisco
0.organizationName = Organization Name (eg, company)
0.organizationName_default = StrongLoop, Inc.
organizationalUnitName = Organizational Unit Name (eg, section)
organizationalUnitName_default = Engineering
commonName = Common Name (e.g. server FQDN or YOUR name)
commonName_default = strongloop.com

[v3_req]
' > openssl-req.conf

echo 01 > serial.txt

# Must be really empty, openssl chokes on leading whitespace.
echo -n '' > index.txt

mkdir -p ./newcerts

openssl genrsa -des3 -out root.key -passout pass:root 1024

openssl req -batch -config openssl-req.conf -new -x509 -days 9999 \
  -key root.key -passin pass:root -out root.cert

openssl genrsa -des3 -out server.key -passout pass:server 1024

(cat openssl-req.conf ; echo "subjectAltName = IP:127.0.0.1") \
  > openssl-req2.conf

openssl req -batch -config openssl-req2.conf -new -key server.key \
  -passin pass:server -out server.csr

openssl ca -batch -config openssl-ca.conf -days 9999 -policy policy_anything \
  -in server.csr -out server.cert -keyfile root.key -passin pass:root \
  -cert root.cert

openssl genrsa -des3 -out client.key -passout pass:client 1024

# Remove passphrase.
openssl rsa -in client.key -passin pass:client -out client.key

# Must have a unique CN.
openssl req -batch -config openssl-req.conf -new -subj '/CN=a.strongloop.com' \
  -key client.key -out client.csr

openssl ca -batch -config openssl-ca.conf -days 9999 -policy policy_anything \
  -in client.csr -out client.cert -keyfile root.key -passin pass:root \
  -cert root.cert

# Export without a passphrase.
openssl pkcs12 -export -in client.cert -inkey client.key -certfile root.cert \
  -out client.p12 -passout pass:
