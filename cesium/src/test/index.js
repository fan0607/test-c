// Add a clipping plane, a plane geometry to show the representation of the
// plane, and control the magnitude of the plane distance with the mouse.

const viewer = new Cesium.Viewer("cesiumContainer", {
  
});
const scene = viewer.scene;

viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(
  "2022-08-01T00:00:00Z"
);

const clipObjects = ["BIM", "Point Cloud", "Instanced", "Model"];
const viewModel = {
  debugBoundingVolumesEnabled: false,
  edgeStylingEnabled: true,
  exampleTypes: clipObjects,
  currentExampleType: clipObjects[0],
};

let targetY = 0.0;
let planeEntities = [];
let selectedPlane;
let clippingPlanes;

// Select plane when mouse down
const downHandler = new Cesium.ScreenSpaceEventHandler(
  viewer.scene.canvas
);
//监听鼠标左键的事件
downHandler.setInputAction(function (movement) {
  const pickedObject = scene.pick(movement.position);
  if (
    Cesium.defined(pickedObject) &&
    Cesium.defined(pickedObject.id) &&
    Cesium.defined(pickedObject.id.plane)
  ) {
    selectedPlane = pickedObject.id.plane;
    selectedPlane.material = Cesium.Color.WHITE.withAlpha(0.05);
    selectedPlane.outlineColor = Cesium.Color.WHITE;
    scene.screenSpaceCameraController.enableInputs = false;//暂时禁止相机随鼠标转动
  }
}, Cesium.ScreenSpaceEventType.LEFT_DOWN);

// Release plane on mouse up
const upHandler = new Cesium.ScreenSpaceEventHandler(
  viewer.scene.canvas
);
upHandler.setInputAction(function () {
  if (Cesium.defined(selectedPlane)) {
    selectedPlane.material = Cesium.Color.WHITE.withAlpha(0.1);
    selectedPlane.outlineColor = Cesium.Color.WHITE;
    selectedPlane = undefined;
  }

  scene.screenSpaceCameraController.enableInputs = true;
}, Cesium.ScreenSpaceEventType.LEFT_UP);

// Update plane on mouse move
const moveHandler = new Cesium.ScreenSpaceEventHandler(
  viewer.scene.canvas
);
moveHandler.setInputAction(function (movement) {
    //movement.startPosition
    //movement.endPosition
  if (Cesium.defined(selectedPlane)) {
    const deltaY = movement.startPosition.y - movement.endPosition.y;
    targetY += deltaY;
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

//工厂函数，该函数会接收一个plane对象，并改变plane的distance属性后返回该plane
function createPlaneUpdateFunction(plane) {
  return function () {
    plane.distance = targetY;
    return plane;
  };
}

let tileset;
async function loadTileset(resource, modelMatrix) {
  const currentExampleType = viewModel.currentExampleType;

  clippingPlanes = new Cesium.ClippingPlaneCollection({
    planes: [
      new Cesium.ClippingPlane(
        new Cesium.Cartesian3(0.0, 0.0, -1.0),
        0.0
      ),
    ],
    edgeWidth: viewModel.edgeStylingEnabled ? 1.0 : 0.0,
  });

  try {
    const url = await Promise.resolve(resource);
    tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
      clippingPlanes: clippingPlanes,
    });

    if (currentExampleType !== viewModel.currentExampleType) {
      // Another tileset was loaded, discard the current result
      return;
    }

    if (Cesium.defined(modelMatrix)) {
      tileset.modelMatrix = modelMatrix;
    }

    viewer.scene.primitives.add(tileset);

    tileset.debugShowBoundingVolume =
      viewModel.debugBoundingVolumesEnabled;
    const boundingSphere = tileset.boundingSphere;
    const radius = boundingSphere.radius;

    viewer.zoomTo(
      tileset,
      new Cesium.HeadingPitchRange(0.5, -0.2, radius * 4.0)
    );

    if (
      !Cesium.Matrix4.equals(
        tileset.root.transform,
        Cesium.Matrix4.IDENTITY
      )
    ) {
      // The clipping plane is initially positioned at the tileset's root transform.
      // Apply an additional matrix to center the clipping plane on the bounding sphere center.
      const transformCenter = Cesium.Matrix4.getTranslation(
        tileset.root.transform,
        new Cesium.Cartesian3()
      );
      const transformCartographic = Cesium.Cartographic.fromCartesian(
        transformCenter
      );
      const boundingSphereCartographic = Cesium.Cartographic.fromCartesian(
        tileset.boundingSphere.center
      );
      const height =
        boundingSphereCartographic.height -
        transformCartographic.height;
      clippingPlanes.modelMatrix = Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(0.0, 0.0, height)
      );
    }

    for (let i = 0; i < clippingPlanes.length; ++i) {
      const plane = clippingPlanes.get(i);
      const planeEntity = viewer.entities.add({
        position: boundingSphere.center,
        plane: {
          dimensions: new Cesium.Cartesian2(radius * 2.5, radius * 2.5),
          material: Cesium.Color.WHITE.withAlpha(0.1),
          plane: new Cesium.CallbackProperty(
            createPlaneUpdateFunction(plane),
            false
          ),
          outline: true,
          outlineColor: Cesium.Color.WHITE,
        },
      });

      planeEntities.push(planeEntity);
    }
    return tileset;
  } catch (error) {
    console.log(`Error loading  tileset: ${error}`);
  }
}

function loadModel(url) {
  clippingPlanes = new Cesium.ClippingPlaneCollection({
    planes: [
      new Cesium.ClippingPlane(
        new Cesium.Cartesian3(0.0, 0.0, -1.0),
        0.0
      ),
    ],
    edgeWidth: viewModel.edgeStylingEnabled ? 1.0 : 0.0,
  });

  const position = Cesium.Cartesian3.fromDegrees(
    -123.0744619,
    44.0503706,
    300.0
  );
  const heading = Cesium.Math.toRadians(135.0);
  const pitch = 0.0;
  const roll = 0.0;
  const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(
    position,
    hpr
  );
  const entity = viewer.entities.add({
    name: url,
    position: position,
    orientation: orientation,
    model: {
      uri: url,
      scale: 8,
      minimumPixelSize: 100.0,
      clippingPlanes: clippingPlanes,
    },
  });

  viewer.trackedEntity = entity;

  for (let i = 0; i < clippingPlanes.length; ++i) {
    const plane = clippingPlanes.get(i);
    const planeEntity = viewer.entities.add({
      position: position,
      plane: {
        dimensions: new Cesium.Cartesian2(300.0, 300.0),
        material: Cesium.Color.WHITE.withAlpha(0.1),
        plane: new Cesium.CallbackProperty(
          createPlaneUpdateFunction(plane),
          false
        ),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    });

    planeEntities.push(planeEntity);
  }
}

// Power Plant design model provided by Bentley Systems
const bimUrl = Cesium.IonResource.fromAssetId(1240402);
const pointCloudUrl = Cesium.IonResource.fromAssetId(16421);
const instancedUrl =
  "../SampleData/Cesium3DTiles/Instanced/InstancedOrientation/tileset.json";
const modelUrl = "../SampleData/models/CesiumAir/Cesium_Air.glb";

loadTileset(bimUrl);

// Track and create the bindings for the view model
const toolbar = document.getElementById("toolbar");
Cesium.knockout.track(viewModel);
Cesium.knockout.applyBindings(viewModel, toolbar);

Cesium.knockout
  .getObservable(viewModel, "currentExampleType")
  .subscribe(function (newValue) {
    reset();

    if (newValue === clipObjects[0]) {
      loadTileset(bimUrl);
    } else if (newValue === clipObjects[1]) {
      loadTileset(pointCloudUrl);
    } else if (newValue === clipObjects[2]) {
      // Position the instanced tileset above terrain
      loadTileset(
        instancedUrl,
        Cesium.Matrix4.fromTranslation(
          new Cesium.Cartesian3(15.0, -58.6, 50.825)
        )
      );
    } else {
      loadModel(modelUrl);
    }
  });

Cesium.knockout
  .getObservable(viewModel, "debugBoundingVolumesEnabled")
  .subscribe(function (value) {
    if (Cesium.defined(tileset)) {
      tileset.debugShowBoundingVolume = value;
    }
  });

Cesium.knockout
  .getObservable(viewModel, "edgeStylingEnabled")
  .subscribe(function (value) {
    const edgeWidth = value ? 1.0 : 0.0;

    clippingPlanes.edgeWidth = edgeWidth;
  });

function reset() {
  viewer.entities.removeAll();
  if (Cesium.defined(tileset)) {
    viewer.scene.primitives.remove(tileset);
  }

  planeEntities = [];
  targetY = 0.0;
  tileset = undefined;
}

