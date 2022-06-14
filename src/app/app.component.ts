import {
  Component,
  AfterContentInit,
  OnInit
} from '@angular/core';

import {
  assign,
  reject,
  map as lodashMap,
  reduce,
  find,
  groupBy,
  orderBy,
  findLast,
  takenWhile,
  mapValues,
  keyBy,
  merge,
} from 'lodash';


import {
  FlowEdge,
  DesignerDocumentConfiguration,
  DesignerDocumentTypes,
  FlowPortType,
} from './models';


/*
  Estoy modelando lo que hago en el designer dentro del prototipo

  Debo agregar un tipo de documento "FLOW"

  El componente encargado de llamar al designer, debe transformar la lista de 
  grupos dinámicos en bloques + connections + layout.

  Las connections se pueden sacar a partir de los grupos dinámicos, dónde:
  * Cada grupo-dinámico está conectado con sus acciones
  * El goto del expiración define al próximo nodo que se conecta 
  * El goto del onExit define a qué nodo se conecta

  El layout debe guardarse en la entidad flujo.

  Los bloques son parte del body en el designer,
  y el layout + connections es parte de la configuración del documento

  Casos desde parent:
    Cargar distintas conexiones  -> configuration
    Agregar / Eliminar bloque    -> configuration + blocks
    Cargar distintos bloques     -> configuration + blocks

  Casos desde usuario:
    Mover bloque                 -> configuration
    Agregar conexion             -> configuration
    Eliminar conexion            -> configuration

*/
/*
  // @@@@ Estoy aqui

  // TODO: Convertir blocks+configuration en grupos dinámicos
  //       Una vez que se valide el flujo debo convertirlo
  //       en un conjunto de grupos dinámicos
  
  USANDO PATHS DESDE CADA NODE

  Hice una función para extraer todos los paths que se generan desde un node

  Y luego apliqué una magia lodash para tener:

  {[nodoid]: {out: [block1...], expiration: [block1...]}}

  Ahora me falta:

  1 Agregar los paths de entrada hasta el primer node
    Ahi puedo buscar todos los paths, conseguir el primer node
    y luego agregar en el puerto in, los bloques

  2 En cada puerto debo hacer la magia correspondiente:
    Si llega hasta un node, debo cambiarlo por un action del tipo "mandar a todo tal"
    Formatear los datos como hacen falta en el backend
    (aqui seguramente habrá que hacer una magia para transforma estructura plana
    en alguna estructura que sea la requerida para el action o el rule)
    
  Con eso creo que ya estarían listo la conversión a grupos dinámicos

  De entrada sé que hay un sólo node... o sea que podría buscarlo desde los starts
  
  // TODO: Hacer más compactos los bloques de los bloques
  //       Utilicé esta paleta:
  //       https://coolors.co/abe188-f7ef99-f1bb87-f78e69-5d675b

  //       Algunas ideas de diagramas
  //       https://visme.co/blog/flowchart-examples/ 

  // TODO: Cambiar el tipo de bloque desde NODE a CHECKPOINT
  //       en teoría de graphs todos los nodos son nodes... 
  //       y es confuso llamar a un tipo con el genérico

*/

// TODO: @Optional: Implementar contador de paths
//       Se podría poner en las propiedades los paths que tiene un flujo
//       y se podrían resaltar en el inspector del flujo
//       Me parece un dato interesante
//       y que permite al usuario saber los caminos que a lo mejor no se ven a simple vista

// TODO: @Optional Implementar un drag para hacer el panning
//       Creo que se puede hacer más o moenos fácil con esto:
//       https://github.com/kmturley/touch-scroll/blob/master/js/TouchScroll.js

// TODO: @Server Agregar etiquetas a entidad flujo
//       para facilitar las búsquedas y poder agruparlas fácilmente

// TODO: Importar esto debe el componente flow-designer
import * as flow from './flow-validators';

// TODO: Importar el modelo real
interface DesignerPropertiesValues {
  [index: string] : any;
}

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {


  blocks: DesignerPropertiesValues[] = [
    {uuid: 'start_989', class: 'flow.start'},
    {uuid: 'signal_b46a17', class: 'flow.signal', title: 'Contacto llenó formulario "cita"'},
    {uuid: 'action_2eb091', class: 'flow.action', title: 'Enviar correo Cotizacion'},
    {uuid: 'node_efd2ce', class: 'flow.node', title: 'Consentidos', expireTime: 10},
    {uuid: 'end_989', class: 'flow.end'},
  ];
  
  configuration: DesignerDocumentConfiguration = {
    id: 'xxxx',
    title: 'Primer flujo',
    status: 'DRAFT',
    type: DesignerDocumentTypes.FLOW,
    owner: 'roberto',
    connectorType: 'FLOWCHART',
    zoom: 1,
    themeCss: 'basic-fall',
    layout: {
      'start_989': {top: 0, left: 300 },
      'signal_b46a17': {top: 88, left: 66},
      'action_2eb091': {top: 330, left: 198},
      'node_efd2ce': {top: 400, left: 618},
      'end_989': {top: 550, left: 550}
    },
    edges: [
      {source: {uuid: 'start_989', port: FlowPortType.out}, target: {uuid: 'signal_b46a17', port: FlowPortType.in}},
      {source: {uuid: 'signal_b46a17', port: FlowPortType.out}, target: {uuid: 'action_2eb091', port: FlowPortType.in}},
      {source: {uuid: 'action_2eb091', port: FlowPortType.out}, target: {uuid: 'node_efd2ce', port: FlowPortType.in}},
      {source: {uuid: 'node_efd2ce', port: FlowPortType.expiration}, target: {uuid: 'end_989', port: FlowPortType.in}},
    ],
    errors: {},
    focused: []
  };

/*
  blocks = [];
  configuration = {"title":"Primer flujo","owner":"roberto","layout":{},"zoom":1,"connections":[], edges: []};
*/
  constructor() {}
  
  ngOnInit() {
   
  }

  insertBlock($event: {block: DesignerPropertiesValues, index: number}) {
    
    const newBlock = {...$event.block, uuid: this.generateUuid()}
    /** Actualizamos el layout */
    const newBlockLayout = {top: 0, left: 0};

    this.configuration.layout = Object.assign(this.configuration.layout, {[newBlock.uuid]: newBlockLayout});

    this.blocks = this.blocks.slice().concat([newBlock]);
  }

  deleteBlock($event: {block: DesignerPropertiesValues}) {
    console.log('Abuelo eliminando block-->', $event);
    this.blocks = reject(this.blocks, (b) => b.uuid === $event.block.uuid);
  }

  private generateUuid() {
    return Math.random().toString(16).slice(2, 8);
  }

  save() {
    const configuration = JSON.stringify(this.configuration);
    console.log('GUARDANDO CONFIGURATION-->');
    console.log(configuration);
    const blocks = JSON.stringify(this.blocks);
    console.log('BLOCKS-->');
    console.log(blocks);

    localStorage.setItem('lastFlow', configuration);
    localStorage.setItem('lastBlocks', blocks);

  }

  loadFromStorage() {
    this.resetData();
    // setTimeout ( () => {
      const lastConfiguration = localStorage.getItem('lastFlow');
      const lastBlocks = localStorage.getItem('lastBlocks');
      if (!lastConfiguration || !lastBlocks) {
        console.warn('No encontré ultima configuration o bloques');
        return;
      }
      this.configuration = JSON.parse(lastConfiguration);
      this.blocks = JSON.parse(lastBlocks);
    // })

  }

  resetData() {
    this.blocks = [];
    this.configuration = {
      id: '',
      themeCss: 'basic-fall',
      connectorType: "FLOWCHART",
      status: 'DRAFT',
      title: "Primer flujo",
      type: DesignerDocumentTypes.FLOW,
      owner :"roberto",
      layout: {},
      zoom: 1,
      edges:[],
      focused: [],
      errors: {}
    };
  }

  close() {
    console.log('A cerrar-->');
  }

  zoomOut() {
    const increment = 0.1;

    const minZoom = 0.25;
  
    const actual = this.configuration.zoom;
    if (actual <= minZoom) { return; }

    this.configuration = assign({}, this.configuration, {zoom: actual - increment});
  }
  zoomIn() {
    const increment = 0.1;
    const maxZoom = 2;
    const actual = this.configuration.zoom;
    if (actual >= maxZoom) { return; }
    this.configuration = assign({}, this.configuration, {zoom: actual + increment});
  }
  resetZoom() {
    const actual = this.configuration.zoom;

    if (actual === 1) { return; }

    this.configuration = assign({}, this.configuration, {zoom: 1});
  }

  flowValuesChange($event) {
    console.log('========> NUEVO FLOW en el papa->', $event);
    this.configuration = assign({}, $event.flow);
  }

  updateConnectorType(value: string) {
    this.configuration = assign({}, this.configuration, {connectorType: value});
  }

  updateTheme(value: string) {
    this.configuration = assign({}, this.configuration, {themeCss: value});
  }

  // TODO: Mover esta función al componente designer-flow
  //       esta función es similar a sendTest que se emite desde aqui
  //       y se maneja en el componente que lo llama
  validate() {
    const errors = flow.validateFlow(this.blocks, this.configuration.edges);

    console.table(errors);

    this.configuration = assign({}, this.configuration, {errors: errors});

    return errors;
    
  }

  focusBlocks(blockIds: string[]) {
    this.configuration = assign({}, this.configuration, {focused: blockIds});
  }
  unfocusBlocks(blockIds: string[]) {
    this.configuration = assign({}, this.configuration, {focused: []});
  }
  focusEdge(edge) {
    const blockIds = [edge.source.block, edge.target.block];
    this.configuration = assign({}, this.configuration, {focused:blockIds});
  }

  // TODO: Mover esta función al componente designer-flow
  //       esta función es similar a sendTest que se emite desde aqui
  //       y se maneja en el componente que lo llama
  publish() {
    const errors = this.validate();
    if (Object.keys(errors).length > 0) {
      console.warn('El flujo tiene errores y no puedo convertirlo');
      return;
    }

    const paths = flow.getPathsFromNodes(this.blocks, this.configuration.edges);

    console.log('... 1 paths:', paths);

    const clustered = lodashMap(paths, path => ({block: path[0].block, port: path[0].edge.split('-')[0], path: path}));
    console.log('... 2 clustered:', clustered);

    const reduced = reduce(clustered, (acum, v) => {
      if (!acum[v.block]) { acum[v.block] = {}; }
      acum[v.block][v.port] = v.path;
      return acum;
    }, {});

    console.log('... 3 reduced:', reduced);

    // TODO: Falta agregar el "in" para el primer entryCheckpoint

  }
}

