# Areas for the ISEXY help guides

One Director per region or province and one District Manager per municipality or borough are created from these files (see `docs/GUIDES.md` once the guides feature lands).

| File | Rows | Kinds |
| --- | --- | --- |
| `quebec_areas.csv` | 1,180 | 17 `region`, 1,122 `municipality`, 41 `borough` |
| `cuba_areas.csv` | 184 | 16 `province` (15 provinces + Isla de la Juventud), 168 `municipality` |

`slug` is the name lowercased without accents, unique per country: the parent's name (then the type) is added on a collision, and a region or province sharing a place's name gets `-region` or `-province`. Keep `code` as text (leading zeros).

## Sources

- **Québec:** Ministère des Affaires municipales et de l'Habitation, *Répertoire des municipalités du Québec* (Données Québec, licence CC-BY 4.0): `https://donneesouvertes.affmunqc.net/repertoire/MUN.csv` and `ARR.csv`, last modified 2026-11-17. Local municipalities, including the 14 northern villages, 9 Cree villages and 1 Naskapi village; unorganized territories, reserves and category I lands are excluded. Region population is the sum of the répertoire entries. The source's `--` is written as an en dash (16 names).
- **Cuba:** Spanish Wikipedia, *Municipios de Cuba* (revision 171678856, 2026-01-23), cross-checked against citypopulation.de and statoids.com; onei.gob.cu was unreachable. Names follow the 2011 provinces (Artemisa, Mayabeque); Varadero is part of Cárdenas.
