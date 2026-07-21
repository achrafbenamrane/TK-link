/* eslint-disable react/no-unknown-property -- react-three-fiber expose geometry/material/args/position comme props JSX ; c'est l'échappatoire recommandée par R3F. */
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const INK = '#17140F';
const CREAM = '#F6F2EA';
const RED = '#F5311D';

const INTRO_S = 1.3; // durée de l'assemblage, en secondes

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p: number) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};

/** Rectangle arrondi extrudé — le corps 3D du sac, biseauté sur les bords. */
function roundedBox(w: number, h: number, r: number, depth: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geo.center();
  return geo;
}

function Mark({ onSettled }: { onSettled?: () => void }) {
  const group = useRef<THREE.Group>(null);
  const settled = useRef(false);
  const started = useRef<number | null>(null);

  const bagGeo = useMemo(() => roundedBox(1.42, 1.62, 0.24, 0.34), []);
  const inkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: INK, roughness: 0.45, metalness: 0.05 }),
    [],
  );
  const creamMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.5, metalness: 0 }),
    [],
  );
  const redMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: RED, roughness: 0.4, metalness: 0.05 }),
    [],
  );

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (started.current === null) started.current = clock.elapsedTime;
    const t = clock.elapsedTime - started.current;
    const p = Math.min(1, t / INTRO_S);

    // Assemblage : surgit en tournant, avec un léger dépassement d'échelle…
    const introRot = (1 - easeOutCubic(p)) * -Math.PI * 0.7;
    // …puis respiration : oscillation douce une fois posé.
    const idleRot = Math.sin(t * 0.6) * 0.22 * p;
    g.rotation.y = introRot + idleRot;
    g.position.y = Math.sin(t * 0.9) * 0.05 * p;
    const sc = p < 1 ? easeOutBack(p) : 1;
    g.scale.setScalar(sc);

    if (p >= 1 && !settled.current) {
      settled.current = true;
      onSettled?.();
    }
  });

  const zFront = 0.34 / 2 + 0.06;

  return (
    <group ref={group}>
      {/* Corps du sac */}
      <mesh geometry={bagGeo} material={inkMat} />

      {/* Anse : demi-tore posé sur le haut du sac. */}
      <mesh material={inkMat} position={[0, 0.86, 0]}>
        <torusGeometry args={[0.4, 0.075, 16, 40, Math.PI]} />
      </mesh>

      {/* F en relief, composé de trois barres crème. */}
      <mesh material={creamMat} position={[-0.19, 0.02, zFront]}>
        <boxGeometry args={[0.15, 0.74, 0.1]} />
      </mesh>
      <mesh material={creamMat} position={[0.0, 0.32, zFront]}>
        <boxGeometry args={[0.46, 0.15, 0.1]} />
      </mesh>
      <mesh material={creamMat} position={[-0.04, 0.03, zFront]}>
        <boxGeometry args={[0.34, 0.14, 0.1]} />
      </mesh>

      {/* Point rouge — la signature « Freedoo. ». */}
      <mesh material={redMat} position={[0.52, -0.64, zFront]}>
        <sphereGeometry args={[0.11, 24, 24]} />
      </mesh>
    </group>
  );
}

type Props = {
  onSettled?: () => void;
  size?: number;
};

/**
 * Logo Freedoo en VRAIE 3D (three.js via expo-gl) : le sac s'assemble en
 * tournant, éclairé pour un rendu volumétrique, puis respire en boucle.
 *
 * ⚠ expo-gl est un module NATIF — visible uniquement dans un build, jamais au
 * rechargement à chaud. Le fond du canevas est transparent pour se poser sur
 * l'écran d'accueil ink.
 */
export function Logo3D({ onSettled, size = 260 }: Props) {
  return (
    <Canvas
      style={{ width: size, height: size }}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 4.4], fov: 42 }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, -2, 2]} intensity={0.4} color={RED} />
      <Mark onSettled={onSettled} />
    </Canvas>
  );
}
