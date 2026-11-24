import { lazy, Suspense, type ComponentProps } from 'react'
import { BlinkArt } from '../BlinkArt'
import type { PetStage } from '../../types'

const PetWebGLCanvas = lazy(() =>
  import('./PetWebGLCanvas').then((m) => ({ default: m.PetWebGLCanvas })),
)

type Props = ComponentProps<typeof PetWebGLCanvas> & {
  stage: PetStage
}

/** Code-split three.js — SVG placeholder until the chunk loads. */
export function LazyPetWebGL({ stage, ...props }: Props) {
  return (
    <Suspense
      fallback={
        <div
          className={`pet-webgl pet-webgl--fallback ${props.className ?? ''}`.trim()}
          aria-label={props['aria-label']}
        >
          <BlinkArt stage={stage} mood="idle" />
        </div>
      }
    >
      <PetWebGLCanvas {...props} />
    </Suspense>
  )
}
