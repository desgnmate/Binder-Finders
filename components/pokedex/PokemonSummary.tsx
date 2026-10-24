import { getTypeBadgeColor } from "../../lib/data";
import { pokemonImage as gen3Sprite,type PokemonTile as PokedexTile } from "../../lib/cms/pokemon";

export function PokemonSummary({ tile }: { tile: PokedexTile }) {
  return (
    <div data-pokedex-preview-panel="true" className="rounded-[18px] border-[3px] border-ink-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
      <div className="relative flex aspect-[4/3] items-center justify-center rounded-[14px] border-2 border-ink-black bg-cream">
        <span className="absolute left-3 top-3 font-retro text-[10px] text-ink-black/50">#{String(tile.id).padStart(3, "0")}</span>
        <img src={gen3Sprite(tile.id)} alt={tile.name} width={240} height={240} className="h-full max-h-64 w-full object-contain p-5 [image-rendering:pixelated]" />
      </div>
      <div className="px-1 pb-1 pt-4">
        <h3 className="font-headline text-2xl font-bold text-ink-black sm:text-3xl">{tile.name}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cream px-3 py-1 font-body text-xs font-bold text-ink-black">{tile.details.generation}</span>
          {tile.types.map((type) => <span key={type} className={`rounded-full px-3 py-1 font-body text-xs font-bold ${getTypeBadgeColor(type)}`}>{type}</span>)}
        </div>
      </div>
    </div>
  );
}
