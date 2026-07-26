# Campus Angadi — Global Store & Product Search

This patch adds the student-facing store discovery and store-wise product comparison experience.

## Included

- Global search for either a store name or product name
- Dedicated `/search?q=...` page
- Matching store cards with delivery time, lowest matching price and offer summary
- Store-wise product comparison table
- Price, discount, stock and delivery sorting/filtering
- Store name and identity on every search-result product
- Add to cart and Buy now actions
- Home-page search now opens global marketplace search
- Official Store, Stores directory and navbar now use the new experience
- Responsive mobile and desktop layouts
- Public API endpoint: `GET /api/v1/stores/search?q=...`

## Validation

- API TypeScript production build: passed
- Web TypeScript + Vite production build: passed
- Targeted ESLint check for the new marketplace page: passed

Second-hand listings and second-hand chat/calling are not changed.
