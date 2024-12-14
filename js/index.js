"use strict";

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_TYPE = "LoadDefaults";
const KEYS = [
  // ["w", "Width: "],
  // ["h", "Height: "],
  ["seed", "Seed: "],
  ["steps", "Steps: "],
  ["cfg", "CFG scale: "],
  ["sampler", "Sampler: "],
  ["scheduler", "Scheduler: "],
  ["strength", "Denoising strength: "],
  ["pp", "\nPositive prompt:\n"],
  ["np", "\nNegative prompt:\n"],
];

const CKPT_TYPES = [
  "CheckpointLoaderSimple",
  "Load Checkpoint",
  "CheckpointLoader|pysssss",
  "Checkpoint Loader", // WAS
];

let loadedData;

async function load() {
  const response = await api.fetchApi(`/shinich39/load-defaults/load`, {
    method: "GET",
    headers: { "Content-Type": "application/json", },
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  const d = await response.json();

  return d;
}

function findData(ckptName) {
  const filename = ckptName.split(".").slice(0, ckptName.split(".").length - 1).join(".");
  if (!loadedData) {
    return;
  }

  const versionData = loadedData.data.find((d) => d.filenames.indexOf(filename) > -1);
  if (!versionData) {
    return;
  }

  return versionData;
}

function getCkptNodes() {
  let nodes = [];
  for (const node of app.graph._nodes) {
    if (node.type === "SimpleCheckpoint") {
      nodes.push(node);
    }
  }
  return nodes;
}

function createNote(str, x, y) {
  let newNode = LiteGraph.createNode("Note");
  newNode.pos = [x, y];
  newNode.size = [368, 512];
  newNode.widgets[0].value = str;
  app.canvas.graph.add(newNode, false);
  app.canvas.selectNode(newNode);
  return newNode;
}

app.registerExtension({
	name: `shinich39.${NODE_TYPE}`,
  setup() {
    load().then((res) => loadedData = res);
  },
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
		const isCkpt = CKPT_TYPES.indexOf(nodeType.comfyClass) > -1;
    if (isCkpt) {
      const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
      nodeType.prototype.getExtraMenuOptions = function (_, options) {
        const r = origGetExtraMenuOptions ? origGetExtraMenuOptions.apply(this, arguments) : undefined;

        try {
          const ckptWidget = this.widgets.find((w) => w.name == "ckpt_name");
          if (!ckptWidget) {
            return r;
          }
  
          const ckptName = ckptWidget.value;
          const data = findData(ckptName);
          const dataLen = data?.metadata.length || 0;
          const metadata = data?.metadata || [];

          let optionIndex = options.findIndex((o) => o?.content === "Properties");
          if (optionIndex > -1) {
            let newOptions = [
              {
                content: "Load Defaults",
                disabled: dataLen < 1,
                submenu: {
                  options: metadata.map((d, i) => {
                    return {
                      content: `${i}`,
                      callback: () => {
                        let str = "";
                        str += `Model: ${data.modelName}\n`;
                        str += `Version: ${data.versionName}\n`;
                        str += `Updated: ${new Date(data.updatedAt).toISOString().split('T')[0]}\n\n`;

                        str += `URL: https://civitai.com/models/${data.modelId}?modelVersionId=${data.versionId}\n\n`;

                        if (d.w && d.h) {
                          str += `Size: ${d.w} x ${d.h}\n`;
                        }
                        for (const [key, label] of KEYS) {
                          if (d[key]) {
                            str += `${label}${d[key]}\n`;
                          }
                        }
                        
                        createNote(str, this.pos[0] + this.size[0] + 16, this.pos[1]);
                      }
                    }
                  })
                }
              }
            ];
            
            options.splice(
              optionIndex,
              0,
              ...newOptions
            );
          }
        } catch(err) {
          console.error(err);
        }

        return r;
      } 
    }
	},
});