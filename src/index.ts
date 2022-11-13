import { debounce, floor, range, round } from 'lodash-es';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Stats from 'three/examples/jsm/libs/stats.module';
import { degToRad } from 'three/src/math/MathUtils';
import {
  getDisplayCentralAngle,
  getZoom,
  createEquirectangularCanvas,
  vector3ToLngLat,
} from './utils/map';
import { MapOptions, XYZ } from './types';
import equirectangularTile from './utils/equirectangularTile';
import { multiply } from './utils/array';

// 地球半径 6371km
const earthRadius = 6371;
const fov = 60;

class Mapo {
  scene = new THREE.Scene();
  ro = new ResizeObserver(() => {});
  camera = new THREE.PerspectiveCamera();
  tileSize = 512;

  constructor(options: MapOptions) {
    const container =
      typeof options.container === 'string'
        ? document.body.querySelector(options.container)
        : options.container;
    if (!container) {
      console.error('can not find container');
      return;
    }
    const pixelRatio = container.clientWidth / container.clientHeight;
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(pixelRatio);
    container.appendChild(renderer.domElement);

    const near = Math.pow(10, -10);
    const camera = new THREE.PerspectiveCamera(
      fov,
      pixelRatio,
      earthRadius * near,
      earthRadius * 10,
    );
    camera.position.set(0, 0, earthRadius * 2);
    camera.lookAt(0, 0, 0);

    const stats = Stats();
    container.appendChild(stats.dom);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020924);
    scene.fog = new THREE.Fog(0x020924, 200, 1000);

    scene.add(this.createMesh([0, 0, 0]));

    // const geom = new THREE.BufferGeometry();
    // const positions = [];
    // for (let i = 0; i < starCount; i++) {
    //   const particle = new THREE.Vector3(
    //     Math.random() * starBgWidth - starBgWidth / 2,
    //     Math.random() * starBgWidth - starBgWidth / 2,
    //     Math.random() * starBgWidth - starBgWidth / 2,
    //   );
    //   // 距离圆心的距离
    //   const distance = Math.sqrt(
    //     Math.pow(particle.x, 2) +
    //       Math.pow(particle.y, 2) +
    //       Math.pow(particle.z, 2),
    //   );
    //   if (distance > outEarthRadius) {
    //     positions.push(particle.x, particle.y, particle.z);
    //   }
    // }
    // geom.attributes.position = new THREE.Float32BufferAttribute(positions, 3);
    // const starsMaterial = new THREE.PointsMaterial({
    //   color: 0x4d76cf,
    //   // map: createCanvasTexture(),
    //   size: 10,
    //   transparent: true,
    //   opacity: 1,
    //   sizeAttenuation: true,
    //   depthTest: true,
    //   depthWrite: true,
    // });
    // // https://juejin.cn/post/7051410402936094751
    // starsMaterial.onBeforeCompile = (shader) => {
    //   shader.fragmentShader = shader.fragmentShader.replace(
    //     'vec4 diffuseColor = vec4( diffuse, opacity );',
    //     `
    //       if (distance(gl_PointCoord, vec2(0.5, 0.5)) > 0.5) discard;
    //       vec4 diffuseColor = vec4( diffuse, opacity );
    //     `,
    //   );
    // };
    // const stars = new THREE.Points(geom, starsMaterial);
    // scene.add(stars);

    // fetch('/countries.geo.json')
    //   .then((resp) => resp.json())
    //   .then((data) => {
    //     const canvas = document.createElement('canvas');
    //     const height = 5000;
    //     const width = height * 2;
    //     canvas.width = width;
    //     canvas.height = height;
    //     const ctx = canvas.getContext('2d');

    //     ctx.fillStyle = '#fff';
    //     ctx.fillRect(0, 0, width, height);

    //     const path = d3.geoPath(
    //       d3.geoEquirectangular().fitSize([width, height], data),
    //     );
    //     data.features.forEach((f) => {
    //       ctx.stroke(new Path2D(path(f)));
    //     });

    //     material.map = new THREE.CanvasTexture(canvas);
    //     material.needsUpdate = true;
    //   });

    // 镜头控制器
    const controls = this.createOrbitControls(camera, renderer.domElement);

    // 页面重绘动画
    const tick = () => {
      // console.log(controls.getDistance());
      controls && controls.update();
      stats.update();
      // 更新渲染器
      renderer.render(scene, camera);
      // 页面重绘时调用自身
      window.requestAnimationFrame(tick);
    };
    tick();

    const ro = new ResizeObserver(() => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      const _pixelRatio = container.clientWidth / container.clientHeight;
      renderer.setPixelRatio(_pixelRatio);
      camera.aspect = _pixelRatio;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    this.ro = ro;
    this.scene = scene;
    this.camera = camera;
  }

  openAuxiliaryLine() {
    const originPoint = new THREE.Vector3(0, 0, 0);
    const arr: [THREE.Vector3, number][] = [
      [new THREE.Vector3(earthRadius * 2, 0, 0), 0xff0000],
      [new THREE.Vector3(0, earthRadius * 2, 0), 0x00ff00],
      [new THREE.Vector3(0, 0, earthRadius * 2), 0x0000ff],
    ];
    arr.forEach(([targetPoint, color]) => {
      this.scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([originPoint, targetPoint]),
          new THREE.LineBasicMaterial({
            color: color,
            fog: false,
          }),
        ),
      );
    });
  }

  createOrbitControls(camera: THREE.Camera, domElement?: HTMLElement) {
    const controls = new OrbitControls(camera, domElement);
    // TODO 阻尼
    // controls.enableDamping = true;
    // controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.minDistance = earthRadius * (1 + Math.pow(10, -5));
    controls.maxDistance = earthRadius * 4;
    controls.zoomSpeed = 1;

    const changed = debounce(() => {
      const zoom = getZoom(controls.getDistance(), earthRadius, fov);
      const z = round(zoom);
      const lngLat = vector3ToLngLat(camera.position);
      const centralAngle = getDisplayCentralAngle(
        controls.getDistance(),
        earthRadius,
        fov,
      );
      const halfCentralAngle = centralAngle / 2;
      const bbox = [
        lngLat.lng - halfCentralAngle,
        lngLat.lat - halfCentralAngle,
        lngLat.lng + halfCentralAngle,
        lngLat.lat + halfCentralAngle,
      ].map((v, i) => {
        switch (i) {
          case 0:
            return v >= -180 ? v : 360 + v;
          case 1:
            return v >= -90 ? v : 180 + v;
          case 2:
            return v <= 180 ? v : v - 360;
          case 3:
            return v <= 90 ? v : v - 180;
          default:
            return 0;
        }
      });

      const rotate = 0;
      const pan = 0;
      location.hash = `${floor(zoom, 2)}/${floor(lngLat.lng, 3)}/${floor(
        lngLat.lat,
        3,
      )}`;
      const [x1, y1] = equirectangularTile.pointToTile(bbox[0], bbox[1], z);
      const [x2, y2] = equirectangularTile.pointToTile(bbox[2], bbox[3], z);

      // 移除 z 更大的 group
      this.scene.children.forEach((object) => {
        if (object instanceof THREE.Group && z < Number(object.name)) {
          this.scene.remove(object);
        }
      });

      multiply(range(x1, x2 + 1), range(y2, y1 + 1)).forEach(([x, y]) => {
        const xyz: XYZ = [x, y, z];
        let group = this.scene.children.find(
          (object) =>
            object instanceof THREE.Group && object.name === String(z),
        );
        if (!group) {
          group = new THREE.Group();
          group.name = String(z);
          this.scene.add(group);
        }
        if (group.children.some((mesh) => mesh.name === xyz.join())) {
          return;
        }
        const mesh = this.createMesh(xyz);
        mesh.name = xyz.join();
        group.add(mesh);
      });
    }, 500);

    // https://discourse.threejs.org/t/detect-changes-of-camera-properties-via-orbitcontrols/14921
    controls.addEventListener('change', () => {
      const zoom = getZoom(controls.getDistance(), earthRadius, fov);
      controls.zoomSpeed = 10 / Math.pow(2, zoom);

      changed();
    });
    changed();
    return controls;
  }

  createMesh(xyz: XYZ) {
    const mesh = new THREE.Mesh();
    mesh.rotateY(degToRad(-90));

    createEquirectangularCanvas(xyz, this.tileSize).then((canvas) => {
      const [x, y, z] = xyz;
      console.log(xyz);

      // 某一行或某一列的瓦片数量
      const tileCount = Math.pow(2, z);
      const lngGap = 360 / tileCount;
      const latGap = lngGap / 2;
      const geometry = new THREE.SphereGeometry(
        earthRadius,
        (2 * Math.pow(2, 10)) / tileCount,
        Math.pow(2, 10) / tileCount,
        degToRad(lngGap * x),
        degToRad(lngGap),
        degToRad(latGap * y),
        degToRad(latGap),
      );

      const material = new THREE.MeshBasicMaterial({
        fog: false,
        map: new THREE.CanvasTexture(canvas),
      });

      mesh.geometry = geometry;
      mesh.material = material;
    });
    return mesh;
  }

  destroy() {
    this.ro.disconnect();
  }
}

export default Mapo;
