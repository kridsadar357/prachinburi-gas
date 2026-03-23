'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type OilAssistant3DProps = {
  size?: number;
  className?: string;
};

export function OilAssistant3D({ size = 34, className }: OilAssistant3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 5.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    keyLight.position.set(1.2, 2.2, 3.2);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xb3e5ff, 0.4);
    fillLight.position.set(-1.2, 1.5, 2.5);
    scene.add(fillLight);

    const character = new THREE.Group();
    scene.add(character);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x5cc8ff,
      roughness: 0.32,
      metalness: 0.05,
    });

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 18), bodyMat);
    body.scale.set(0.92, 1.18, 0.86);
    character.add(body);

    const headTip = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.9, 18), bodyMat);
    headTip.position.set(0, 1.18, 0);
    character.add(headTip);

    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 })
    );
    shine.position.set(-0.25, 0.62, 0.7);
    shine.scale.set(1.0, 0.72, 0.6);
    character.add(shine);

    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x374151 });
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff8fab, transparent: true, opacity: 0.65 });

    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), eyeWhiteMat);
    const rightEye = leftEye.clone();
    leftEye.position.set(-0.26, 0.16, 0.78);
    rightEye.position.set(0.26, 0.16, 0.78);
    character.add(leftEye, rightEye);

    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), pupilMat);
    const rightPupil = leftPupil.clone();
    leftPupil.position.set(-0.26, 0.15, 0.93);
    rightPupil.position.set(0.26, 0.15, 0.93);
    character.add(leftPupil, rightPupil);

    const leftSparkle = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const rightSparkle = leftSparkle.clone();
    leftSparkle.position.set(-0.21, 0.22, 0.98);
    rightSparkle.position.set(0.31, 0.22, 0.98);
    character.add(leftSparkle, rightSparkle);

    const leftBlush = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), blushMat);
    const rightBlush = leftBlush.clone();
    leftBlush.position.set(-0.44, -0.02, 0.82);
    rightBlush.position.set(0.44, -0.02, 0.82);
    character.add(leftBlush, rightBlush);

    const smileMat = new THREE.MeshBasicMaterial({ color: 0xf0f9ff });
    const smileCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.21, -0.2, 0.9),
      new THREE.Vector3(0, -0.3, 0.98),
      new THREE.Vector3(0.21, -0.2, 0.9)
    );
    const smile = new THREE.Mesh(new THREE.TubeGeometry(smileCurve, 12, 0.025, 8, false), smileMat);
    character.add(smile);

    const leftArm = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.35, metalness: 0.05 })
    );
    const rightArm = leftArm.clone();
    leftArm.position.set(-0.82, 0.1, 0.12);
    rightArm.position.set(0.82, 0.1, 0.12);
    character.add(leftArm, rightArm);

    let raf = 0;
    let last = 0;
    const targetFrameMs = 1000 / 30;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderLoop = (t: number) => {
      raf = requestAnimationFrame(renderLoop);
      if (t - last < targetFrameMs) return;
      last = t;

      const time = t * 0.001;
      if (!reduceMotion) {
        character.position.y = Math.sin(time * 2.0) * 0.07;
        character.rotation.z = Math.sin(time * 1.3) * 0.05;
        character.rotation.y = Math.sin(time * 0.9) * 0.11;

        leftPupil.position.x = -0.26 + Math.sin(time * 1.5) * 0.012;
        rightPupil.position.x = 0.26 + Math.sin(time * 1.5) * 0.012;

        const blink = Math.max(0.5, Math.abs(Math.sin(time * 0.55 + 0.8)));
        leftEye.scale.y = blink;
        rightEye.scale.y = blink;
        leftSparkle.scale.setScalar(0.9 + Math.sin(time * 2.0) * 0.05);
        rightSparkle.scale.setScalar(0.9 + Math.sin(time * 2.0 + 0.5) * 0.05);
      }

      renderer.render(scene, camera);
    };

    raf = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      body.geometry.dispose();
      headTip.geometry.dispose();
      leftEye.geometry.dispose();
      leftPupil.geometry.dispose();
      smile.geometry.dispose();
      bodyMat.dispose();
      eyeWhiteMat.dispose();
      pupilMat.dispose();
      smileMat.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
