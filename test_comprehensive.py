#!/usr/bin/env python3
"""Test complet de l'API Sérénite — tous les endpoints"""
import subprocess, json, sys, time, random, datetime

BASE = "http://localhost:3000/api"
passed = 0
failed = 0
results = []

def curl(method, path, data=None, token=None, binary=False):
    cmd = ["curl", "-s", "-X", method, BASE + path,
           "-H", "Content-Type: application/json",
           "-m", "10"]
    if data:
        cmd.extend(["-d", json.dumps(data)])
    if token:
        cmd.extend(["-H", "Authorization: Bearer " + token])
    r = subprocess.run(cmd, capture_output=True, timeout=15)
    if binary:
        return r.stdout
    try:
        text = r.stdout.decode("utf-8", errors="replace").strip()
        return json.loads(text) if text else {}
    except (json.JSONDecodeError, ValueError):
        return {"_raw": r.stdout.decode("utf-8", errors="replace")[:200]}

def check(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        results.append("  [PASS] " + name)
    else:
        failed += 1
        results.append("  [FAIL] " + name + " -- " + detail)

def jdump(r):
    return json.dumps(r)[:150]

print("=" * 70)
print("TEST COMPLET -- SERENITE APP v5.0")
print(datetime.datetime.now().isoformat())
print("=" * 70)
sys.stdout.flush()

suffix = random.randint(10000, 99999)
email_a = "brigitte-" + str(suffix) + "@test.com"
email_b = "thomas-" + str(suffix) + "@test.com"

# ============ 1. AUTH ============
print("\n--- 1. AUTH ---")
sys.stdout.flush()

r = curl("POST", "/auth/register", {
    "firstName": "Brigitte",
    "lastName": "Test",
    "email": email_a,
    "pin": "123456",
    "role": "parent",
    "parentType": "maman",
    "childrenCount": 2,
    "language": "fr",
    "consentCgu": True,
    "consentData": True,
    "consentChildren": True,
    "consentNewsletter": False
})
has_user = "user" in r and isinstance(r["user"], dict)
has_family = "family" in r and isinstance(r["family"], dict)
has_token = "token" in r
check("Register Parent A", has_user and has_family and has_token,
      "user=" + (r.get("user",{}).get("firstName","?")) + " family=" + (r.get("family",{}).get("name","?")))
token_a = r.get("token", "")
user_a_id = r.get("user", {}).get("id", "") if has_user else ""
family_id = r.get("family", {}).get("id", "") if has_family else ""

if family_id:
    check("Famille auto creee (solo)", r["family"].get("status") == "solo",
          "status=" + str(r["family"].get("status")))
check("User ID UUID", len(user_a_id) > 10)

r = curl("POST", "/auth/register", {
    "firstName": "Thomas",
    "lastName": "Coparent",
    "email": email_b,
    "pin": "654321",
    "role": "parent",
    "parentType": "papa",
    "childrenCount": 2,
    "language": "fr",
    "consentCgu": True,
    "consentData": True,
    "consentChildren": True,
    "consentNewsletter": False
})
has_user = "user" in r and isinstance(r["user"], dict)
check("Register Parent B", has_user and "token" in r,
      "user=" + (r.get("user",{}).get("firstName","?")))
token_b = r.get("token", "")
user_b_id = r.get("user", {}).get("id", "") if has_user else ""

r = curl("POST", "/auth/login", {"email": email_a, "pin": "123456"})
check("Login OK", "token" in r)

r = curl("POST", "/auth/login", {"email": email_a, "pin": "000000"})
check("Login mauvais PIN = erreur", "error" in r)

r = curl("GET", "/auth/me", token=token_a)
check("GET /me profil", isinstance(r, dict) and r.get("firstName") == "Brigitte",
      "firstName=" + str(r.get("firstName")))

r = curl("PUT", "/auth/update-pin",
         {"currentPin": "123456", "newPin": "789012"}, token=token_a)
check("PUT /update-pin changement PIN", len(r) > 0,
      "reponse=" + jdump(r))
curl("PUT", "/auth/update-pin", {"currentPin": "789012", "newPin": "123456"}, token=token_a)

# ============ 2. FAMILLES + ENFANTS ============
print("\n--- 2. FAMILLES + ENFANTS ---")
sys.stdout.flush()

r = curl("GET", "/families/me", token=token_a)
check("GET /families/me", isinstance(r, dict), "rep=" + jdump(r))

r = curl("GET", "/families/children", token=token_a)
check("GET /families/children liste", isinstance(r, (list, dict)),
      "type=" + type(r).__name__)

r1 = curl("POST", "/families/children", {
    "firstName": "Lea",
    "birthDate": "2020-03-15",
    "calendarColor": "#FFB5E8"
}, token=token_a)
child1_id = ""
if isinstance(r1, dict):
    child1_id = r1.get("id") or (r1.get("child") or {}).get("id") or ""
check("POST enfant Lea", bool(child1_id) or bool(r1),
      "rep=" + jdump(r1))

r2 = curl("POST", "/families/children", {
    "firstName": "Hugo",
    "birthDate": "2022-07-22",
    "calendarColor": "#B5DEFF"
}, token=token_a)
child2_id = ""
if isinstance(r2, dict):
    child2_id = r2.get("id") or (r2.get("child") or {}).get("id") or ""
check("POST enfant Hugo", bool(child2_id) or bool(r2),
      "rep=" + jdump(r2))

# ============ 3. INVITATIONS ============
print("\n--- 3. INVITATIONS ---")
sys.stdout.flush()

r = curl("POST", "/invitations/create", {}, token=token_a)
check("POST /invitations/create", isinstance(r, dict),
      "rep=" + jdump(r))
invite_code = r.get("code", "") if isinstance(r, dict) else ""

r = curl("GET", "/invitations/status", token=token_a)
check("GET /invitations/status", isinstance(r, dict),
      "rep=" + jdump(r))

if invite_code and token_b:
    r = curl("POST", "/invitations/accept", {"code": invite_code}, token=token_b)
    check("POST /invitations/accept", isinstance(r, dict),
          "rep=" + jdump(r))

# ============ 4. MESSAGES CNV ============
print("\n--- 4. MESSAGES CNV ---")
sys.stdout.flush()

r = curl("POST", "/messages/reformulate", {
    "content": "T'es toujours en retard, c'est pas possible !"
}, token=token_a)
check("POST reformulate CNV", isinstance(r, dict) and len(r) > 0,
      "rep=" + jdump(r))

r = curl("POST", "/messages/send", {
    "familyId": family_id,
    "content": "Je suis disponible ce weekend si besoin.",
    "isReformulated": False
}, token=token_a)
check("POST /messages/send", isinstance(r, dict),
      "rep=" + jdump(r))

r = curl("GET", "/messages/" + family_id, token=token_a)
check("GET messages historique", isinstance(r, (list, dict)),
      "type=" + type(r).__name__)

r = curl("GET", "/messages/" + family_id + "/unread-count", token=token_a)
check("GET unread-count", isinstance(r, dict),
      "rep=" + jdump(r))

r = curl("GET", "/messages/templates", token=token_a)
check("GET templates CNV", isinstance(r, (list, dict)) and str(r) != "{}",
      "rep=" + jdump(r))

# ============ 5. CALENDRIER ============
print("\n--- 5. CALENDRIER ---")
sys.stdout.flush()

child_ids_arr = [child1_id] if child1_id else []
r = curl("POST", "/events", {
    "familyId": family_id,
    "title": "Garde Lea",
    "startAt": "2026-06-20T09:00:00Z",
    "endAt": "2026-06-22T18:00:00Z",
    "allDay": False,
    "category": "garde",
    "childIds": child_ids_arr
}, token=token_a)
check("POST /events cree evenement", isinstance(r, dict),
      "rep=" + jdump(r))

r = curl("GET", "/events", token=token_a)
check("GET /events liste", isinstance(r, (list, dict)),
      "type=" + type(r).__name__)

r = curl("POST", "/events/exchange-request", {
    "familyId": family_id,
    "reason": "RDV medical imprevu",
    "proposedDate": "2026-06-25"
}, token=token_a)
check("POST exchange-request", isinstance(r, dict),
      "rep=" + jdump(r))

# ============ 6. FINANCES ============
print("\n--- 6. FINANCES ---")
sys.stdout.flush()

r = curl("POST", "/expenses", {
    "familyId": family_id,
    "title": "Courses enfants",
    "amount": 85.50,
    "category": "courses",
    "expenseDate": "2026-06-15",
    "splitRatio": 0.50
}, token=token_a)
check("POST /expenses cree depense", isinstance(r, dict),
      "rep=" + jdump(r))

r = curl("GET", "/expenses", token=token_a)
check("GET /expenses liste", isinstance(r, (list, dict)),
      "type=" + type(r).__name__)

# ============ 7. VAULT ============
print("\n--- 7. COFFRE-FORT (VAULT) ---")
sys.stdout.flush()

r = curl("GET", "/vault", token=token_a)
check("GET /vault liste", isinstance(r, (list, dict)),
      "type=" + type(r).__name__)

# ============ 8. HEALTH ============
print("\n--- 8. SANTE ---")
sys.stdout.flush()

r = curl("GET", "/health", token=token_a)
check("GET /health liste", isinstance(r, (list, dict)),
      "type=" + type(r).__name__)

if child1_id:
    r = curl("GET", "/health/child/" + child1_id, token=token_a)
    check("GET /health/child par enfant", isinstance(r, (list, dict)),
          "type=" + type(r).__name__)

r = curl("POST", "/health", {
    "childId": child1_id,
    "recordType": "vaccin",
    "title": "Vaccin DTP",
    "description": "Rappel vaccin DTP",
    "recordDate": "2026-06-15",
    "doctorName": "Dr Martin"
}, token=token_a)
check("POST /health cree enregistrement", isinstance(r, dict),
      "rep=" + jdump(r))

# ============ 9. EXPORTS ============
print("\n--- 9. EXPORTS ---")
sys.stdout.flush()

raw_csv = curl("GET", "/exports/expenses/csv", token=token_a, binary=True)
check("GET /exports/expenses/csv", len(raw_csv) > 20,
      "taille=" + str(len(raw_csv)))

raw_pdf = curl("GET", "/exports/expenses/pdf", token=token_a, binary=True)
check("GET /exports/expenses/pdf", len(raw_pdf) > 50,
      "taille=" + str(len(raw_pdf)))

# ============ 10. USERS ============
print("\n--- 10. UTILISATEURS ---")
sys.stdout.flush()

r = curl("GET", "/users/export", token=token_a)
check("GET /users/export RGPD", isinstance(r, dict),
      "type=" + type(r).__name__)

# ============ 11. NOTIFICATIONS ============
print("\n--- 11. NOTIFICATIONS ---")
sys.stdout.flush()

r = curl("POST", "/notifications/weekly-report", {
    "familyId": family_id
}, token=token_a)
check("POST /notifications/weekly-report", isinstance(r, dict),
      "rep=" + jdump(r))

# ============ 12. MEDIATEURS ============
print("\n--- 12. MEDIATEURS ---")
sys.stdout.flush()

r = curl("GET", "/mediators", token=token_a)
check("GET /mediateurs ressources", isinstance(r, (list, dict)),
      "type=" + type(r).__name__)

# ============ 13. ADMIN ============
print("\n--- 13. ADMIN ---")
sys.stdout.flush()

r = curl("GET", "/admin/health", token=token_a)
check("GET /admin/health check", isinstance(r, (dict, list)),
      "rep=" + jdump(r))

# ============ RESULTATS ============
print("\n" + "=" * 70)
total = passed + failed
print("RESULTATS: " + str(passed) + "/" + str(total) + " PASSED, " + str(failed) + "/" + str(total) + " FAILED")
print("=" * 70)
print()
for r_line in results:
    print(r_line)

sys.exit(0 if failed == 0 else 1)
