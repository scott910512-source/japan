# H×H / Gon installation icons

Gon artwork is reused without redrawing from the existing project asset
`src/assets/hunter/characters/gon.png`, sourced from the
[official NEN×IMPACT character page](https://hunterhunter-ni.bushiroad.com/character/gon/).
Original characters and artwork belong to their respective rights holders.

The icon layout, aura and H×H lettering are repo-native SVG in
`src/assets/hunter/hxh-gon-icon.svg`. Regenerate the committed PNG installation
sizes and standalone SVG favicon using `node tools/render-hunter-icons.mjs`.

The full-bleed 512px maskable icon keeps the face and H×H lettering in the central
safe area. The 180px PNG is used by iOS home-screen installation.
