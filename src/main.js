import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

const ThreeScene = () => {
  const mountRef = useRef(null);
  const [model, setModel] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const mixerRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    //инициализация
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    camera.position.set(0, 2, 5);

    //запись состояний
    cameraRef.current = camera;
    rendererRef.current = renderer;
    sceneRef.current = scene;
    controlsRef.current = controls;

    //Техтуры
    const loadTexture = () => {
      return new Promise((resolve, reject) => {
        new RGBELoader()
          .setPath('./')
          .load('skyes.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
            resolve();
          }, undefined, reject);
      });
    };
    //Модель
    const loadModel = () => {
      return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./draco/');
        loader.setDRACOLoader(dracoLoader);
        loader.load('./model.glb', resolve, undefined, reject);
      });
    };
    //генерация сцены
    const initScene = async () => {
      try {
        await loadTexture();
        const gltf = await loadModel();
        const loadedModel = gltf.scene;
        loadedModel.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        loadedModel.scale.set(1, 1, 1);
        scene.add(loadedModel);
        setModel(loadedModel);

        const mixer = new THREE.AnimationMixer(loadedModel);
        mixerRef.current = mixer;

        if (gltf.animations.length > 0) {
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        const clock = new THREE.Clock();

        //прокрутка анимации
        const animate = () => {
          requestAnimationFrame(animate);
          const delta = clock.getDelta();
          if (mixerRef.current) mixerRef.current.update(delta);
          controlsRef.current.update();
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        animate();
      } catch (error) {
        console.error('An error happened:', error);
      }
    };

    initScene();
    //нажатия
    const onClick = (event) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

      if (model) {
        const intersects = raycasterRef.current.intersectObject(model, false);
        if (intersects.length > 0) {
          setIsZoomed(prevIsZoomed => !prevIsZoomed);
        }
      }
    };

    const handleResize = () => {
      //масштабирование
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };

    const handleKeyDown = (event) => {
      //проверка нажатия на M или m
      if (event.key === 'M' || event.key === 'm') {
        setIsZoomed(prevIsZoomed => !prevIsZoomed);
      }
    };

    window.addEventListener('click', onClick);
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
        if (model) {
          sceneRef.current.remove(model);
          model.traverse((object) => {
            if (object.isMesh) {
              object.geometry.dispose();
              if (object.material.isMaterial) {
                cleanMaterial(object.material);
              } else {
                for (const material of object.material) {
                  cleanMaterial(material);
                }
              }
            }
          });
        }
      }
    };
  }, []);

  useEffect(() => {
    if (model) {
      const camera = cameraRef.current;
      if (camera) {
        if (isZoomed) {
          model.scale.set(2, 2, 2);
        } else {
          model.scale.set(1, 1, 1);
        }
      }
    }
  }, [isZoomed, model]);

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
};

//очистка материалов
const cleanMaterial = (material) => {
  material.dispose();
  if (material.map) material.map.dispose();
  if (material.lightMap) material.lightMap.dispose();
  if (material.bumpMap) material.bumpMap.dispose();
  if (material.normalMap) material.normalMap.dispose();
  if (material.specularMap) material.specularMap.dispose();
  if (material.envMap) material.envMap.dispose();
};

export default ThreeScene;
