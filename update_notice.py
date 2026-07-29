import json

with open("notice.txt", "r", encoding="utf-8") as f:
    new_message = f.read().strip()

with open("notice.json", "r", encoding="utf-8") as f:
    data = json.load(f)

data["version"] += 1
data["message"] = new_message

with open("notice.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print(f"Notice updated to version {data['version']}")
