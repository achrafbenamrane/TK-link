/* eslint-disable react/no-unknown-property -- react-three-fiber expose geometry/material/args/position comme props JSX ; c'est l'échappatoire recommandée par R3F. */
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { colors } from '@/shared/theme/colors';

/**
 * LE GESTE DU PRODUIT, en vraie 3D : la carte TK LINK descend sur le lecteur,
 * touche, et les ondes du sans-contact partent.
 *
 * Le site raconte la même scène en CSS ; ici on a le volume, donc on s'en sert :
 * la carte tourne dans l'espace, la lumière rasante donne son épaisseur au
 * boîtier, et le contact se voit à l'écrasement de l'ombre. Une vidéo aurait
 * pesé des mégaoctets et n'aurait pas réagi à la taille de l'écran.
 *
 * ⚠ expo-gl est un module NATIF : visible dans un build de développement, pas
 * au rechargement à chaud d'Expo Go.
 */

const CYCLE = 5.2; // durée d'un aller-retour complet, en secondes
const CONTACT = 1.5; // instant du contact carte / lecteur
const LIFT = 3.1; // instant où la carte repart

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** Rectangle arrondi extrudé — carte et boîtier partagent la même fabrique. */
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
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.center();
  return geo;
}

/**
 * Une onde : un anneau qui s'ouvre et s'efface depuis le lecteur.
 *
 * Matériau et maillage passent par des `ref` — c'est l'échappatoire prévue
 * pour une valeur qu'on écrit à chaque image. Un objet mémoïsé muté dans la
 * boucle de rendu ferait (à juste titre) rougir le compilateur React.
 */
function Ring({ delay }: { delay: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const m = mesh.current;
    const material = mat.current;
    if (!m || !material) return;
    // L'onde ne vit qu'après le contact : avant, elle n'a aucune raison d'être.
    const t = (clock.elapsedTime % CYCLE) - CONTACT - delay;
    if (t < 0 || t > 1.4) {
      material.opacity = 0;
      return;
    }
    const p = t / 1.4;
    m.scale.setScalar(0.5 + easeOutCubic(p) * 2.2);
    material.opacity = (1 - p) * 0.5;
  });

  return (
    <mesh ref={mesh} position={[0, -0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.62, 0.7, 48]} />
      <meshBasicMaterial
        ref={mat}
        color={colors.lime}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Scene() {
  const card = useRef<THREE.Group>(null);
  const reader = useRef<THREE.Group>(null);

  const cardGeo = useMemo(() => roundedBox(1.7, 1.08, 0.12, 0.05), []);
  const bodyGeo = useMemo(() => roundedBox(2.1, 1.5, 0.22, 0.34), []);

  const cardMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colors.brand600, roughness: 0.35 }),
    [],
  );
  const limeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colors.lime, roughness: 0.3 }),
    [],
  );
  const shellMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#EDF1E7', roughness: 0.55 }),
    [],
  );
  const portMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#20261B', roughness: 0.7 }),
    [],
  );

  useFrame(({ clock }) => {
    const c = card.current;
    const r = reader.current;
    if (!c || !r) return;

    const t = clock.elapsedTime % CYCLE;

    if (t < CONTACT) {
      // Approche : la carte descend en se redressant à plat sur le lecteur.
      const p = easeInOutCubic(t / CONTACT);
      c.position.set(0.15 - p * 0.15, 1.5 - p * 1.24, 0.55 - p * 0.35);
      c.rotation.set(-0.95 + p * 0.45, 0.75 - p * 0.5, 0.22 - p * 0.22);
    } else if (t < LIFT) {
      // Contact : un rebond court, puis la carte reste posée le temps de l'échange.
      const p = (t - CONTACT) / (LIFT - CONTACT);
      const bounce = Math.max(0, Math.sin(p * Math.PI * 3)) * 0.06 * (1 - p);
      c.position.set(0, 0.26 + bounce, 0.2);
      c.rotation.set(-0.5, 0.25, 0);
    } else {
      // Retrait : elle repart en tournant, prête pour le tour suivant.
      const p = easeInOutCubic((t - LIFT) / (CYCLE - LIFT));
      c.position.set(p * 0.15, 0.26 + p * 1.24, 0.2 + p * 0.35);
      c.rotation.set(-0.5 - p * 0.45, 0.25 + p * 0.5, p * 0.22);
    }

    // Le boîtier respire à peine : il ancre la scène, il ne l'anime pas.
    r.rotation.y = Math.sin(clock.elapsedTime * 0.35) * 0.12;
  });

  return (
    <group position={[0, -0.1, 0]}>
      {/* ---------------------------------------------------------- lecteur */}
      <group ref={reader} position={[0, -0.75, 0]} rotation={[0.34, 0, 0]}>
        <mesh geometry={bodyGeo} material={shellMat} />
        {/* Écran / zone de lecture, en creux sur le dessus */}
        <mesh material={limeMat} position={[0, 0.16, 0.19]}>
          <boxGeometry args={[1.1, 0.06, 0.02]} />
        </mesh>
        {/* Port USB-C sur la face avant */}
        <mesh material={portMat} position={[0, -0.62, 0.1]}>
          <boxGeometry args={[0.34, 0.08, 0.06]} />
        </mesh>
      </group>

      {/* Les ondes partent du dessus du lecteur, décalées dans le temps. */}
      <Ring delay={0} />
      <Ring delay={0.22} />
      <Ring delay={0.44} />

      {/* ------------------------------------------------------------ carte */}
      <group ref={card}>
        <mesh geometry={cardGeo} material={cardMat} />
        {/* Bande lime : la signature de la carte, lisible même à cette taille. */}
        <mesh material={limeMat} position={[0, -0.34, 0.031]}>
          <boxGeometry args={[1.5, 0.1, 0.01]} />
        </mesh>
        {/* Puce */}
        <mesh material={limeMat} position={[-0.5, 0.16, 0.031]}>
          <boxGeometry args={[0.26, 0.2, 0.01]} />
        </mesh>
        {/* Trois barres : les ondes du sigle, en relief. */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={limeMat} position={[0.28 + i * 0.14, 0.16, 0.031]}>
            <boxGeometry args={[0.05, 0.16 + i * 0.1, 0.01]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function CardReader3D({ size = 300 }: { size?: number }) {
  return (
    <Canvas
      style={{ width: size, height: size }}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.9, 5], fov: 40 }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, 1, 2]} intensity={0.6} color={colors.lime} />
      <Scene />
    </Canvas>
  );
}
