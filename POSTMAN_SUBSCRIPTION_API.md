# 🚀 Postman API Documentation: Register Subscription & License Service

Dokumentasi lengkap dan siap pakai (*ready-to-use*) untuk pengujian API registrasi subscription / lisensi pada **POS-License Service**.

---

## 📌 Ringkasan Layanan & Konfigurasi

| Parameter | Nilai Default | Keterangan |
| :--- | :--- | :--- |
| **Base URL** | `http://localhost:4000` | Port default service POS-License |
| **Prefix Route** | `/api/license` | Endpoint grup lisensi & registrasi |
| **Format Data** | `application/json` | Header `Content-Type: application/json` wajib dikirim |
| **Autentikasi** | Publik (Registration / Bootstrap) | Tidak memerlukan Bearer token untuk register awal |

---

## ⚙️ Postman Environment Setup

Buat sebuah Environment di Postman dengan variabel-variabel berikut untuk mempermudah eksekusi:

| Variable | Initial / Current Value | Deskripsi |
| :--- | :--- | :--- |
| `baseUrl` | `http://localhost:4000` | Alamat host POS-License service |
| `username` | `admin_test_{{$timestamp}}` | Username admin baru (menggunakan dynamic timestamp) |
| `password` | `password123` | Password admin (minimal 4 karakter) |
| `licenseKey` | *(Kosong - terisi otomatis via test script)* | Menyimpan `licenseCode` hasil registrasi |
| `masterKey` | *(Kosong - terisi otomatis via test script)* | Menyimpan `masterKey` hasil registrasi |
| `subdomain` | `tokoberkah{{$timestamp}}` | Subdomain khusus untuk plan PRO |

---

## 📋 Daftar Endpoint

### 1. Register Subscription (POST `/api/license/register`)

Digunakan untuk mendaftarkan akun administrator baru sekaligus menerbitkan lisensi / subscription sesuai tingkatan plan (`FREE`, `PRO`, `ENTERPRISE`).

#### 🔹 Request Headers
```http
Content-Type: application/json
```

#### 🔹 Request Body Specification
| Field | Tipe | Wajib? | Default | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| `username` | `string` | **Ya** | - | Username unik admin client (min. 1 karakter). |
| `password` | `string` | **Ya** | - | Password akun admin (minimal 4 karakter). |
| `plan` | `string` | Tidak | `"FREE"` | Pilihan: `"FREE"`, `"PRO"`, `"ENTERPRISE"`. |
| `clientName`| `string` | Tidak | `""` | Nama toko / bisnis / client. |
| `email` | `string` | Tidak | `""` | Alamat email pemilik bisnis. |
| `subdomain` | `string` | Opsional | Auto-generated | Nama subdomain Cloudflare Tunnel. Otomatis dibentuk dari gabungan `username` + `clientName`. Jika sudah ada yang sama, ditambahkan *random number* di belakangnya. |

---

### Skenario Uji 1: Register Subscription Plan FREE
* Karakteristik: `maxUsers: 5`, Cloudflare Tunnel: `false`, Masa aktif: Selamanya (`startDate: null`, `expiredDate: null`).

#### Request
* **Method:** `POST`
* **URL:** `{{baseUrl}}/api/license/register`
* **Body (raw JSON):**
```json
{
  "username": "admin_free_01",
  "password": "password123",
  "plan": "FREE",
  "clientName": "Toko Berkah Free",
  "email": "owner@tokoberkah.com"
}
```

#### Postman Test Script (Tests Tab)
```javascript
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});

pm.test("Subscription registered successfully", function () {
    const json = pm.response.json();
    pm.expect(json.success).to.eql(true);
    pm.expect(json.data.plan).to.eql("FREE");
    pm.expect(json.data.limits.maxUsers).to.eql(5);
    pm.expect(json.data.limits.cloudflareIncluded).to.eql(false);
    pm.expect(json.data.expiredDate).to.be.null;

    // Simpan ke environment
    pm.environment.set("licenseKey", json.data.licenseCode);
    pm.environment.set("masterKey", json.data.user.masterKey);
});
```

#### Response Sukses (201 Created):
```json
{
  "success": true,
  "message": "License registered and admin user created successfully",
  "data": {
    "licenseId": "8b0870be-21cf-4d9a-9e8c-52ffba3cba01",
    "licenseCode": "NOMA-FREE-3A9B-12C4-8D7F",
    "plan": "FREE",
    "user": {
      "userId": "9f1e4b1a-d820-43b9-a2a1-123456789abc",
      "username": "admin_free_01",
      "role": "ADMIN",
      "masterKey": "MK-7B9A1C2D-NOMA-FREE-3A9B-12C4-8D7F"
    },
    "limits": {
      "maxUsers": 5,
      "cloudflareIncluded": false
    },
    "cloudflare": {
      "enabled": false
    },
    "startDate": null,
    "expiredDate": null
  }
}
```

---

### Skenario Uji 2: Register Subscription Plan PRO
* Karakteristik: `maxUsers: 100`, Cloudflare Tunnel: `true`, Masa aktif: 1 tahun dari tanggal registrasi, memerlukan parameter `subdomain`.

#### Request
* **Method:** `POST`
* **URL:** `{{baseUrl}}/api/license/register`
* **Body (raw JSON):**
```json
{
  "username": "admin_pro_01",
  "password": "passwordPro456",
  "plan": "PRO",
  "clientName": "Toko Maju Bersama",
  "email": "owner@tokomaju.com",
  "subdomain": "tokomaju"
}
```

#### Postman Test Script (Tests Tab)
```javascript
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});

pm.test("PRO Subscription & Cloudflare provisioned", function () {
    const json = pm.response.json();
    pm.expect(json.success).to.eql(true);
    pm.expect(json.data.plan).to.eql("PRO");
    pm.expect(json.data.limits.maxUsers).to.eql(100);
    pm.expect(json.data.limits.cloudflareIncluded).to.eql(true);
    pm.expect(json.data.expiredDate).to.not.be.null;
    pm.expect(json.data.cloudflare.enabled).to.eql(true);

    pm.environment.set("proLicenseKey", json.data.licenseCode);
    pm.environment.set("tunnelToken", json.data.cloudflare.tunnelToken);
});
```

#### Response Sukses (201 Created):
```json
{
  "success": true,
  "message": "License registered and admin user created successfully",
  "data": {
    "licenseId": "3c98d6f1-a3f4-4e2b-b9d1-321456987ef0",
    "licenseCode": "NOMA-PRO-A1B2-C3D4-E5F6",
    "plan": "PRO",
    "user": {
      "userId": "2a1e3b4c-5d6e-7f8a-9b0c-123456abcdef",
      "username": "admin_pro_01",
      "role": "ADMIN",
      "masterKey": "MK-D1E2F3A4-NOMA-PRO-A1B2-C3D4-E5F6"
    },
    "limits": {
      "maxUsers": 100,
      "cloudflareIncluded": true
    },
    "cloudflare": {
      "enabled": true,
      "subdomain": "tokomaju",
      "fullDomain": "tokomaju.nomapos.com",
      "tunnelId": "tunnel-mock-tokomaju-123456",
      "tunnelToken": "eyJhbGciOi..."
    },
    "startDate": "2026-09-12T15:20:00.000Z",
    "expiredDate": "2027-09-12T15:20:00.000Z"
  }
}
```

---

### Skenario Uji 3: Register Subscription Plan ENTERPRISE (Warning State)
* Sistem mengenali status Enterprise yang belum dibuka secara publik dan memberikan warning terstruktur.

#### Request
* **Method:** `POST`
* **URL:** `{{baseUrl}}/api/license/register`
* **Body (raw JSON):**
```json
{
  "username": "admin_enterprise_01",
  "password": "passwordEnterprise789",
  "plan": "ENTERPRISE",
  "clientName": "PT Korporat Retail",
  "email": "corp@retail.com"
}
```

#### Response (200 OK dengan Flag Warning):
```json
{
  "success": false,
  "warning": true,
  "message": "enterprise is not available right now"
}
```

---

### Skenario Uji 4: Validasi Error - Username / Password Kosong
#### Request
* **Method:** `POST`
* **URL:** `{{baseUrl}}/api/license/register`
* **Body (raw JSON):**
```json
{
  "username": "",
  "password": ""
}
```
#### Response (400 Bad Request):
```json
{
  "success": false,
  "error": "username and password are required fields"
}
```

---

### Skenario Uji 5: Validasi Error - Username Sudah Terdaftar
#### Request
* **Method:** `POST`
* **URL:** `{{baseUrl}}/api/license/register`
* **Body (raw JSON):**
```json
{
  "username": "admin_free_01",
  "password": "password123",
  "plan": "FREE"
}
```
#### Response (400 Bad Request):
```json
{
  "success": false,
  "error": "Username \"admin_free_01\" is already registered. Please choose another username."
}
```

---

### Skenario Uji 6: Subdomain Otomatis dari Username + ClientName (dengan Random Number jika Duplikat)
* Karakteristik: Parameter `subdomain` tidak wajib dikirim. Sistem otomatis membentuk subdomain dari kombinasi `username + clientName`. Jika terjadi duplikasi nama subdomain yang sama, sistem menambahkan 4 digit *random number* di belakangnya.

#### Request
* **Method:** `POST`
* **URL:** `{{baseUrl}}/api/license/register`
* **Body (raw JSON):**
```json
{
  "username": "admin_jaya_01",
  "password": "password123",
  "plan": "PRO",
  "clientName": "Toko Berkah"
}
```

#### Response Sukses (201 Created):
```json
{
  "success": true,
  "message": "License registered and admin user created successfully",
  "data": {
    "licenseCode": "NOMA-PRO-XXXX-YYYY-ZZZZ",
    "plan": "PRO",
    "cloudflare": {
      "enabled": true,
      "subdomain": "adminjaya01tokoberkah",
      "fullDomain": "adminjaya01tokoberkah.nomapos.com",
      "tunnelId": "...",
      "tunnelToken": "..."
    }
  }
}
```
*(Catatan: Jika `adminjaya01tokoberkah` telah terdaftar oleh lisensi lain, maka subdomain otomatis menjadi e.g. `adminjaya01tokoberkah4829`)*

---

## 🔄 API Pendukung Terkait Subscription

### 2. Verify Admin Login & License (POST `/api/license/verify-admin`)
Digunakan oleh backend lokal POS Desktop saat initial bootstrap untuk memverifikasi username & password admin serta mengambil `masterKey` dan data lisensi.

#### Request
* **Method:** `POST`
* **URL:** `{{baseUrl}}/api/license/verify-admin`
* **Body (raw JSON):**
```json
{
  "username": "admin_free_01",
  "password": "password123"
}
```

#### Response Sukses (200 OK):
```json
{
  "success": true,
  "message": "Admin credentials and license verified",
  "data": {
    "valid": true,
    "user": {
      "userId": "9f1e4b1a-d820-43b9-a2a1-123456789abc",
      "username": "admin_free_01",
      "passwordHash": "pbkdf2$10000$...",
      "masterKey": "MK-7B9A1C2D-NOMA-FREE-3A9B-12C4-8D7F",
      "role": "ADMIN"
    },
    "license": {
      "licenseId": "8b0870be-21cf-4d9a-9e8c-52ffba3cba01",
      "licenseCode": "NOMA-FREE-3A9B-12C4-8D7F",
      "plan": "FREE",
      "maxUsers": 5,
      "cloudflare": null,
      "expiredDate": null,
      "status": "ACTIVE"
    }
  }
}
```

---

### 3. Check License Status (GET `/api/license/status/:key`)
Mengecek status aktif, tanggal kadaluwarsa, batas user, dan fitur dari lisensi yang terdaftar.

#### Request
* **Method:** `GET`
* **URL:** `{{baseUrl}}/api/license/status/{{licenseKey}}`

#### Response Sukses (200 OK):
```json
{
  "success": true,
  "data": {
    "licenseId": "8b0870be-21cf-4d9a-9e8c-52ffba3cba01",
    "licenseCode": "NOMA-FREE-3A9B-12C4-8D7F",
    "plan": "FREE",
    "clientName": "Toko Berkah Free",
    "status": "ACTIVE",
    "maxUsers": 5,
    "cloudflareIncluded": false,
    "fullDomain": null,
    "startDate": null,
    "expiredDate": null,
    "activatedAt": null
  }
}
```

---

### 4. Activate License (POST `/api/license/activate`)
Mengaktifkan lisensi pada mesin POS tertentu menggunakan `machineId`.

#### Request
* **Method:** `POST`
* **URL:** `{{baseUrl}}/api/license/activate`
* **Body (raw JSON):**
```json
{
  "licenseCode": "{{licenseKey}}",
  "machineId": "DESKTOP-POS-STATION-01"
}
```

---

### 5. Get Plan Benefits Catalog (GET `/api/license/benefits`)
Mengambil katalog benefit untuk setiap paket subscription (`FREE`, `PRO`, `ENTERPRISE`).

#### Request
* **Method:** `GET`
* **URL:** `{{baseUrl}}/api/license/benefits`

#### Response Sukses (200 OK):
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "plan": "FREE",
      "name": "Free Starter",
      "maxUsers": 5,
      "cloudflareIncluded": false,
      "isAvailable": true
    },
    {
      "plan": "PRO",
      "name": "Professional Tier",
      "maxUsers": 100,
      "cloudflareIncluded": true,
      "isAvailable": true
    },
    {
      "plan": "ENTERPRISE",
      "name": "Enterprise Custom",
      "maxUsers": 9999,
      "cloudflareIncluded": true,
      "isAvailable": false
    }
  ]
}
```

---

### 6. List All Licenses (GET `/api/license/list`)
Melihat seluruh daftar lisensi yang terdaftar di sistem.

#### Request
* **Method:** `GET`
* **URL:** `{{baseUrl}}/api/license/list`

---

### 7. Delete / Revoke License (DELETE `/api/license/:key`)
Mencabut atau menghapus lisensi. Tambahkan query `?hard=true` jika ingin hard-delete.

#### Request
* **Method:** `DELETE`
* **URL:** `{{baseUrl}}/api/license/{{licenseKey}}?hard=false`

---

## 📦 Ready-to-Use Postman Collection (v2.1.0 JSON)

Anda dapat langsung meng-copy seluruh kode JSON di bawah ini, lalu buka Postman:
👉 **Import** ➔ **Raw Text** ➔ Paste JSON ➔ Klik **Import**.

```json
{
  "info": {
    "_postman_id": "pos-license-subscription-collection",
    "name": "POS-License Subscription API",
    "description": "Koleksi API Postman ready-to-use untuk menguji pendaftaran subscription, verifikasi lisensi, dan manajemen paket POS.",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:4000",
      "type": "string"
    },
    {
      "key": "licenseKey",
      "value": "",
      "type": "string"
    },
    {
      "key": "masterKey",
      "value": "",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "1. Subscription Registration",
      "item": [
        {
          "name": "Register FREE Subscription",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test(\"Status code is 201\", function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "const res = pm.response.json();",
                  "if (res.success && res.data) {",
                  "    pm.collectionVariables.set(\"licenseKey\", res.data.licenseCode);",
                  "    pm.collectionVariables.set(\"masterKey\", res.data.user.masterKey);",
                  "    console.log(\"Saved License Key:\", res.data.licenseCode);",
                  "}"
                ],
                "type": "text/javascript"
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"admin_free_{{$timestamp}}\",\n  \"password\": \"password123\",\n  \"plan\": \"FREE\",\n  \"clientName\": \"Toko Berkah Free\",\n  \"email\": \"free@tokoberkah.com\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/license/register",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "register"]
            },
            "description": "Daftar subscription FREE dengan limit 5 user (termasuk admin) tanpa Cloudflare tunnel dan berlaku selamanya."
          }
        },
        {
          "name": "Register PRO Subscription (Cloudflare Tunnel)",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test(\"Status code is 201\", function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "const res = pm.response.json();",
                  "if (res.success && res.data) {",
                  "    pm.collectionVariables.set(\"licenseKey\", res.data.licenseCode);",
                  "    pm.collectionVariables.set(\"masterKey\", res.data.user.masterKey);",
                  "    console.log(\"PRO License Code:\", res.data.licenseCode);",
                  "}"
                ],
                "type": "text/javascript"
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"admin_pro_{{$timestamp}}\",\n  \"password\": \"proPassword123\",\n  \"plan\": \"PRO\",\n  \"clientName\": \"Toko Maju Pro\",\n  \"email\": \"pro@tokomaju.com\",\n  \"subdomain\": \"tokomaju{{$timestamp}}\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/license/register",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "register"]
            },
            "description": "Daftar subscription PRO dengan limit 100 user, masa aktif 1 tahun, dan Cloudflare Remote Tunnel provisioning."
          }
        },
        {
          "name": "Register ENTERPRISE Plan (Expected Warning)",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test(\"Status code is 200 with Warning\", function () {",
                  "    pm.response.to.have.status(200);",
                  "    const res = pm.response.json();",
                  "    pm.expect(res.warning).to.eql(true);",
                  "    pm.expect(res.message).to.include(\"enterprise is not available\");",
                  "});"
                ],
                "type": "text/javascript"
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"corp_admin_{{$timestamp}}\",\n  \"password\": \"enterpriseSecret456\",\n  \"plan\": \"ENTERPRISE\",\n  \"clientName\": \"PT Retail Raksasa\",\n  \"email\": \"corp@enterprise.com\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/license/register",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "register"]
            },
            "description": "Menguji penolakan dengan warning terstruktur untuk paket ENTERPRISE yang belum dibuka."
          }
        },
        {
          "name": "Register Validation Error (Empty Fields)",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test(\"Status code is 400 Bad Request\", function () {",
                  "    pm.response.to.have.status(400);",
                  "    const res = pm.response.json();",
                  "    pm.expect(res.success).to.eql(false);",
                  "});"
                ],
                "type": "text/javascript"
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"\",\n  \"password\": \"\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/license/register",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "register"]
            },
            "description": "Menguji respon saat username atau password kosong."
          }
        }
      ]
    },
    {
      "name": "2. Verify & Status",
      "item": [
        {
          "name": "Verify Admin User & License",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"admin_free_01\",\n  \"password\": \"password123\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/license/verify-admin",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "verify-admin"]
            },
            "description": "Verifikasi user admin dari POS backend lokal saat bootstrap awal."
          }
        },
        {
          "name": "Get License Status by Key",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{baseUrl}}/api/license/status/{{licenseKey}}",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "status", "{{licenseKey}}"]
            },
            "description": "Cek detail dan status aktif lisensi berdasarkan kode lisensi."
          }
        },
        {
          "name": "Activate License on Machine",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"licenseCode\": \"{{licenseKey}}\",\n  \"machineId\": \"STATION-CASHIER-01\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/license/activate",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "activate"]
            },
            "description": "Aktivasi lisensi ke hardware ID mesin kasir."
          }
        }
      ]
    },
    {
      "name": "3. Benefits & Catalog",
      "item": [
        {
          "name": "Get All Plan Benefits",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{baseUrl}}/api/license/benefits",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "benefits"]
            },
            "description": "Melihat tabel benefit untuk semua paket lisensi."
          }
        },
        {
          "name": "Get Specific Plan Benefit (PRO)",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{baseUrl}}/api/license/benefits/PRO",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "benefits", "PRO"]
            },
            "description": "Melihat detail benefit spesifik paket PRO."
          }
        }
      ]
    },
    {
      "name": "4. License Management",
      "item": [
        {
          "name": "List All Licenses",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{baseUrl}}/api/license/list",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "list"]
            },
            "description": "Menampilkan seluruh lisensi yang terdaftar di Supabase."
          }
        },
        {
          "name": "Revoke / Delete License",
          "request": {
            "method": "DELETE",
            "header": [],
            "url": {
              "raw": "{{baseUrl}}/api/license/{{licenseKey}}?hard=false",
              "host": ["{{baseUrl}}"],
              "path": ["api", "license", "{{licenseKey}}"],
              "query": [
                {
                  "key": "hard",
                  "value": "false",
                  "description": "Set true untuk menghapus permanen, atau false untuk soft-revoke (status REVOKED)"
                }
              ]
            },
            "description": "Mencabut atau menghapus lisensi client."
          }
        }
      ]
    }
  ]
}
```

---

## 💻 Quick Test Menggunakan cURL

Jika ingin menguji langsung dari terminal atau PowerShell:

### Register Plan FREE:
```bash
curl -X POST http://localhost:4000/api/license/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_curl_free",
    "password": "password123",
    "plan": "FREE",
    "clientName": "Toko Berkah",
    "email": "owner@berkah.com"
  }'
```

### Register Plan PRO:
```bash
curl -X POST http://localhost:4000/api/license/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_curl_pro",
    "password": "password123",
    "plan": "PRO",
    "clientName": "Toko Maju",
    "email": "owner@tokomaju.com",
    "subdomain": "tokomajupro"
  }'
```

### Verify Admin & License:
```bash
curl -X POST http://localhost:4000/api/license/verify-admin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_curl_free",
    "password": "password123"
  }'
```
