# 🧠 SpaCy Model Packaging for Offline Docker Deployment

This module explains how the SpaCy language models are packaged and deployed efficiently in our project — enabling fast, reproducible, and offline-capable builds using Docker.

---

## 📦 Model Integration Strategy

The project includes pre-downloaded `.whl` files for essential SpaCy models directly within the repository. This eliminates the need for network access during Docker image construction.

### 🧰 Included Models:

* **`xx_ent_wiki_sm-3.7.0-py3-none-any.whl`** — Lightweight multilingual NLP model (default)
* **`en_core_web_sm-3.7.1-py3-none-any.whl`** — English-specific model (used as fallback or enhancement)

---

## 🚀 Key Advantages

✅ **Blazing-Fast Docker Builds** — No delays from model downloads during `docker build`

✅ **Offline Compatibility** — Fully functional in restricted or air-gapped environments

✅ **CI/CD Stability** — Immunity from model download failures or network timeouts

✅ **Version Locking** — Ensures consistency of NLP behavior across all environments

✅ **Deterministic Builds** — Builds are reproducible regardless of external server availability

---

## 🔄 Dockerfile Adjustments

### 🔧 Previous Approach (Network Dependent):

```dockerfile
RUN python -m spacy download en_core_web_sm
RUN python -m spacy download xx_ent_wiki_sm
```

### ✅ New Approach (Local `.whl` Files):

```dockerfile
COPY models/*.whl /app/models/
RUN pip install --no-cache-dir /app/models/xx_ent_wiki_sm*.whl
RUN pip install --no-cache-dir /app/models/en_core_web_sm*.whl
```

These changes improve build reliability and eliminate any need for internet access during container creation.

---

## 📊 Impact on Repository Size

| Model              | Size    |
| ------------------ | ------- |
| `xx_ent_wiki_sm`   | \~15 MB |
| `en_core_web_sm`   | \~12 MB |
| **Total Increase** | \~27 MB |

This is a small tradeoff for the gain in stability, speed, and offline functionality.

---

## 🔁 Updating SpaCy Models

To upgrade the models:

1. Run `python download_models.py` locally to fetch updated `.whl` files
2. (Optional) Edit URLs in `download_models.py` to target newer releases
3. Replace old `.whl` files in the `models/` folder
4. Commit the changes to your repository

---

## 🔀 Alternate Strategy: External Model Storage (Optional)

For organizations concerned about repository size or working with numerous large models:

* Maintain a separate repository for `.whl` files
* Leverage **Git LFS** for binary file management
* Fetch models in a CI/CD step prior to Docker build

---

## ✅ Verification Steps

After building your Docker image, run the following command to ensure models are correctly installed:

```bash
docker run your-app python -c "import spacy; print('Installed models:', list(spacy.util.get_installed_models()))"
```

Expected output should include:

```
['xx_ent_wiki_sm', 'en_core_web_sm']
```

---

> This approach enables smooth, version-controlled NLP model deployment that works anywhere — even without an internet connection.
