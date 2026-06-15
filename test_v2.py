#!/usr/bin/env python3
"""Test complet de l'API Serenite - tous les endpoints"""
import subprocess, json, sys, time, random, datetime

BASE = "http://localhost:3000/api"
passed = 0
failed = 0
results = []

def curl(method, path, data=None, token=None, binary=False, tout=8):
    cmd = ["curl", "-s", "-X", method, BASE + path,
           "-H", "Content-Type: application/json", "-m", str(tout)]
    if data:
        cmd.extend(["-d", json.dumps(data)])
    if token:
        auth_hdr = "Authorization: Bearer " + str(token)
        cmd.extend(["-H", auth_hdr])
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=tout + 2)
        if binary:
            return {"ok": True, "data": r.stdout}
        text = r.stdout.decode("utf-8", errors="replace").strip()
        try:
            return {"ok": True, "json": json.loads(text) if text else {}}
        except (json.JSONDecodeError, ValueError):
            return {"ok": True, "json": {"_raw": text[:200]}}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}

def j(r):
    if not r.get("ok"):
        return "timeout/error"
    return json.dumps(r.get("json", {}))[:120]

def check(name, ok, detail=""):
    global passed, failed, results
    if ok:
        passed += 1
        results.append("  [PASS] " + name)
    else:
        failed += 1
        results.append("  [FAIL] " + name + " -- " + detail)

def v(r, key, default=""):
    if not r.get("ok"):
        return default
    jdata = r.get("json", {})
    if isinstance(jdata, dict):
        return jdata.get(key, default)
    return default

def vv(r, k1, k2, default=""):
    if not r.get("ok"):
        return default
    jdata = r.get("json", {})
    if isinstance(jdata, dict):
        inner = jdata.get(k1, {})
        if isinstance(inner, dict):
            return inner.get(k2, default)
    return default

print("=" * 70)
print("TEST COMPLET -- SERENITE APP v5.0")
print(datetime.datetime.now().isoformat())
print("=" * 70)

suffix = random.randint(10000, 99999)
ea = "brig-{}.test.serenite.com".format(suffix)
eb = "tho-{}.test.serenite.com".format(suffix)

# ===== 1. AUTH =====
print("\n--- 1. AUTH ---")
sys.stdout.flush()

r = curl("POST", "/auth/register", {
    "firstName": "Brigitte", "lastName": "Test", "email": ea,
    "pin": "123456", "role": "parent", "parentType": "maman",
    "childrenCount": 2, "language": "fr",
    "consentCgu": True, "consentData": True,
    "consentChildren": True, "consentNewsletter": False
})
uid = vv(r, "user", "id", "")
fid = vv(r, "family", "id", "")
fst = vv(r, "family", "status", "")
ta = v(r, "token", "")
check("Register Parent A", bool(uid) and bool(fid) and bool(ta),
      "user={} family={}".format(vv(r,"user","firstName","?"), vv(r,"family","name","?")))
check("Famille auto creee (solo)", fst == "solo", "status=" + fst)

rb = curl("POST", "/auth/register", {
    "firstName": "Thomas", "lastName": "Co", "email": eb,
    "pin": "654321", "role": "parent", "parentType": "papa",
    "childrenCount": 2, "language": "fr",
    "consentCgu": True, "consentData": True,
    "consentChildren": True, "consentNewsletter": False
})
tb = v(rb, "token", "")
uid_b = vv(rb, "user", "id", "")
check("Register Parent B", bool(tb), "user=" + vv(rb,"user","firstName","?"))

r = curl("POST", "/auth/login", {"email": ea, "pin": "123456"})
check("Login OK", bool(v(r,"token","")), "rep=" + j(r))

r = curl("POST", "/auth/login", {"email": ea, "pin": "000000"})
check("Login mauvais PIN = erreur", bool(v(r,"error","") or v(r,"message","")),
      "rep=" + j(r))

r = curl("GET", "/auth/me", token=ta)
check("GET /me profil", v(r,"firstName","") == "Brigitte",
      "firstName=" + v(r,"firstName",""))

r = curl("PUT", "/auth/update-pin",
         {"currentPin": "123456", "newPin": "789012"}, token=ta)
check("PUT /update-pin", r.get("ok"), "rep=" + j(r))
if ta:
    curl("PUT", "/auth/update-pin", {"currentPin": "789012", "newPin": "123456"}, token=ta)

# ===== 2. FAMILLES =====
print("\n--- 2. FAMILLES + ENFANTS ---")
sys.stdout.flush()

r = curl("GET", "/families/me", token=ta)
check("GET /families/me", r.get("ok"), "rep=" + j(r))

r = curl("GET", "/families/children", token=ta)
check("GET /families/children liste", r.get("ok"),
      "type=" + str(type(r.get("json",""))))

r1 = curl("POST", "/families/children", {
    "firstName": "Lea", "birthDate": "2020-03-15", "calendarColor": "#FFB5E8"
}, token=ta)
c1 = v(r1,"id","") or vv(r1,"child","id","")
check("POST enfant Lea", bool(c1), "rep=" + j(r1))

r2 = curl("POST", "/families/children", {
    "firstName": "Hugo", "birthDate": "2022-07-22", "calendarColor": "#B5DEFF"
}, token=ta)
c2 = v(r2,"id","") or vv(r2,"child","id","")
check("POST enfant Hugo", bool(c2), "rep=" + j(r2))

# ===== 3. INVITATIONS =====
print("\n--- 3. INVITATIONS ---")
sys.stdout.flush()

r = curl("POST", "/invitations/create", {}, token=ta)
icode = v(r,"code","")
check("POST /invitations/create", bool(icode), "rep=" + j(r))

r = curl("GET", "/invitations/status", token=ta)
check("GET /invitations/status", r.get("ok"), "rep=" + j(r))

if icode and tb:
    r = curl("POST", "/invitations/accept", {"code": icode}, token=tb)
    check("POST /invitations/accept", r.get("ok"), "rep=" + j(r))

# ===== 4. MESSAGES CNV =====
print("\n--- 4. MESSAGES CNV ---")
sys.stdout.flush()

r = curl("POST", "/messages/reformulate", {
    "content": "T'es toujours en retard, c'est pas possible !"
}, token=ta)
check("POST reformulate CNV", r.get("ok"), "rep=" + j(r))

r = curl("POST", "/messages/send", {
    "familyId": fid, "content": "Je suis dispo ce weekend.", "isReformulated": False
}, token=ta)
check("POST /messages/send", r.get("ok"), "rep=" + j(r))

r = curl("GET", "/messages/" + fid, token=ta)
check("GET messages historique", r.get("ok"), "type=" + str(type(r.get("json",""))))

r = curl("GET", "/messages/" + fid + "/unread-count", token=ta)
check("GET unread-count", r.get("ok"), "rep=" + j(r))

r = curl("GET", "/messages/templates", token=ta)
check("GET templates CNV", r.get("ok") and str(r.get("json",{})) != "{}",
      "rep=" + j(r))

# ===== 5. CALENDRIER =====
print("\n--- 5. CALENDRIER ---")
sys.stdout.flush()

r = curl("POST", "/events", {
    "familyId": fid, "title": "Garde Lea",
    "startAt": "2026-06-20T09:00:00Z", "endAt": "2026-06-22T18:00:00Z",
    "allDay": False, "category": "garde",
    "childIds": [c1] if c1 else []
}, token=ta)
check("POST /events cree evenement", r.get("ok"), "rep=" + j(r))

r = curl("GET", "/events", token=ta)
check("GET /events liste", r.get("ok"), "type=" + str(type(r.get("json",""))))

r = curl("POST", "/events/exchange-request", {
    "familyId": fid, "reason": "RDV medical", "proposedDate": "2026-06-25"
}, token=ta)
check("POST exchange-request", r.get("ok"), "rep=" + j(r))

# ===== 6. FINANCES =====
print("\n--- 6. FINANCES ---")
sys.stdout.flush()

r = curl("POST", "/expenses", {
    "familyId": fid, "title": "Courses", "amount": 85.50,
    "category": "courses", "expenseDate": "2026-06-15", "splitRatio": 0.50
}, token=ta)
check("POST /expenses cree depense", r.get("ok"), "rep=" + j(r))

r = curl("GET", "/expenses", token=ta)
check("GET /expenses liste", r.get("ok"), "type=" + str(type(r.get("json",""))))

# ===== 7. VAULT =====
print("\n--- 7. VAULT ---")
sys.stdout.flush()

r = curl("GET", "/vault", token=ta)
check("GET /vault liste", r.get("ok"), "type=" + str(type(r.get("json",""))))

# ===== 8. HEALTH =====
print("\n--- 8. SANTE ---")
sys.stdout.flush()

r = curl("GET", "/health", token=ta)
check("GET /health liste", r.get("ok"), "type=" + str(type(r.get("json",""))))

if c1:
    r = curl("GET", "/health/child/" + c1, token=ta)
    check("GET /health/child par enfant", r.get("ok"),
          "type=" + str(type(r.get("json",""))))

r = curl("POST", "/health", {
    "childId": c1, "recordType": "vaccin", "title": "Vaccin DTP",
    "description": "Rappel", "recordDate": "2026-06-15", "doctorName": "Dr Martin"
}, token=ta)
check("POST /health cree enregistrement", r.get("ok"), "rep=" + j(r))

# ===== 9. EXPORTS =====
print("\n--- 9. EXPORTS ---")
sys.stdout.flush()

r = curl("GET", "/exports/expenses/csv", token=ta, binary=True, tout=10)
check("GET /exports/expenses/csv", r.get("ok") and len(r.get("data",b"")) > 20,
      "taille=" + str(len(r.get("data",b""))))

r = curl("GET", "/exports/expenses/pdf", token=ta, binary=True, tout=15)
check("GET /exports/expenses/pdf", r.get("ok") and len(r.get("data",b"")) > 50,
      "taille=" + str(len(r.get("data",b""))))

# ===== 10. USERS =====
print("\n--- 10. USERS ---")
sys.stdout.flush()

r = curl("GET", "/users/export", token=ta)
check("GET /users/export RGPD", r.get("ok"), "type=" + str(type(r.get("json",""))))

# ===== 11. NOTIFICATIONS =====
print("\n--- 11. NOTIFICATIONS ---")
sys.stdout.flush()

r = curl("POST", "/notifications/weekly-report", {"familyId": fid}, token=ta)
check("POST /notifications/weekly-report", r.get("ok"), "rep=" + j(r))

# ===== 12. MEDIATEURS =====
print("\n--- 12. MEDIATEURS ---")
sys.stdout.flush()

r = curl("GET", "/mediators", token=ta)
check("GET /mediateurs ressources", r.get("ok"), "type=" + str(type(r.get("json",""))))

# ===== 13. ADMIN =====
print("\n--- 13. ADMIN ---")
sys.stdout.flush()

r = curl("GET", "/admin/health", token=ta)
check("GET /admin/health check", r.get("ok"), "rep=" + j(r))

# ===== RESULTS =====
print("\n" + "=" * 70)
total = passed + failed
print("RESULTATS: {}/{} PASSED, {}/{} FAILED".format(passed, total, failed, total))
print("=" * 70)
print()
for rl in results:
    print(rl)

sys.exit(0 if failed == 0 else 1)
