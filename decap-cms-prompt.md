# Prompt: Incorporate Decap CMS (Netlify CMS)

**Context:** I have an existing static e-commerce website hosted on Netlify and GitHub. I want to integrate Decap CMS so my customer can edit products and prices via a UI without touching the code.

**Task:** Please guide me through adding Decap CMS to my project. 

**Requirements:**
1. **Admin Folder:** Help me create the `/public/admin` directory with `index.html` and `config.yml`.
2. **Schema Definition:** I need to define a "Products" collection. Each product has a title, price (number), image, and description.
3. **Identity & Auth:** Explain how to enable Netlify Identity and the Git Gateway so the customer can log in at `/admin`.
4. **Data Workflow:** My site currently uses [JSON/Markdown] for product data. Configure the CMS to write changes directly back to these files in the GitHub repository.
5. **Build Trigger:** Ensure that when the customer clicks "Save," Netlify automatically detects the new commit and rebuilds the static site.

Please provide the specific YAML configuration for `config.yml` and the HTML boilerplate for the admin page.
