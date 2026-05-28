# nekopoi-ui

a barebones, raw interface for the [nekopoi-api](https://github.com/yurtzy/nekopoi-api).

### aesthetic

built strictly following minimal "nudity" visual principles:

- no gradients, absolutely flat.
- no emojis.
- colors are extracted from pale off-whites (`#FAECE5`) and deep browns (`#3B2B26`) to simulate an exposed, skin-like tone.
- bare html, css, and js elements with zero external frameworks.

### live

- API: [https://nekopoi-api-yurtzy.vercel.app/](https://nekopoi-api-yurtzy.vercel.app/)
- UI: [https://nekopoi-ui-yurtzy.vercel.app/](https://nekopoi-ui-yurtzy.vercel.app/)

### usage

no build system required. simply serve the directory:

```bash
npx serve .
# or run using live server
```

### features

- front page latest feed tracking.
- search system routing via query params.
- detail view decoding streams and direct downloads natively from the bare interface.
