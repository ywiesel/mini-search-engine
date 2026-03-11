import os

DATA_FOLDER = "../data"

documents = {}

for filename in os.listdir(DATA_FOLDER):
    with open(os.path.join(DATA_FOLDER, filename), "r") as f:
        documents[filename] = f.read()

print(documents)