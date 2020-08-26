const fs = require('fs')
const astPaser = require('@babel/parser')
const traverse = require('babel-traverse').default
const { transformFromAst } = require('babel-core')
const path = require('path')


let fileID = 0

function analyzeFile (filePath) {
  // read file
  let content = fs.readFileSync(filePath, 'utf8')

  // code to AST(abstract syntax tree)
  let ast = astPaser.parse(content, { sourceType: 'module' })

  // [] to save all dependencies' paths in current file
  // These paths are relative to the file that imported them.
  let dependencies = []
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      //node.source.value:  ./message.js
      dependencies.push(node.source.value)
    }
  })

  // AST to code => ensure that our bound.js can run in all browers
  let { code } = transformFromAst(ast, null, {
    presets: ['env']
  })

  let id = fileID++

  let fileInfo = {
    id,
    filePath,
    dependencies,
    code
  }
  return fileInfo
}

function generateGraph (entry) {
  let entryFileInfo = analyzeFile(entry)

  let queue = [entryFileInfo]
  for (fileInfo of queue) {
    fileInfo.mapping = {}

    let dirname = path.dirname(fileInfo.filePath)

    fileInfo.dependencies.forEach(depsPath => {
      let absolutePath = path.join(dirname, depsPath)
      // dirname:  ./static 
      // depsPath:  ./message.js 
      // absolutePath:  static\message.js
      let depsInfo = analyzeFile(absolutePath)

      fileInfo.mapping[depsPath] = depsInfo.id
      queue.push(depsInfo)
    })
  }
  return queue;
}

function bundleGraph (graph) {
  /*
  graph:  [
  {
    id: 0,
    filePath: './static/entry.js',
    dependencies: [ './message.js' ],
    code: '"use strict";\n\nvar _message = require("./message.js");\n\nvar ' +
      '_message2 = _interopRequireDefault(_message);\n\nfunction ' +
      '_interopRequireDefault(obj) { return obj && obj.__esModule ' +
      '? obj : { default: obj }; }\n\n' +
      'console.log(_message2.default);',
    mapping: { './message.js': 1 }
  },
  {
    id: 1,
    filePath: 'static\\message.js',
    dependencies: [ './name.js' ],
    code: '"use strict";\n\nObject.defineProperty(exports, ' +
      '"__esModule", {\n  value: true\n});\n\nvar _name = ' +
      'require("./name.js");\n\nexports.default = "hello " + ' +
      '_name.name + "!";',
    mapping: { './name.js': 2 }
  },
  {
    id: 2,
    filePath: 'static\\name.js',
    dependencies: [],
    code: '"use strict";\n\nObject.defineProperty(exports, "__esModule", ' +
      "{\n  value: true\n});\nvar name = exports.name = 'Miniwebpack';",
    mapping: {}
  }
]
  */
  let modules = ''
  graph.forEach(mod => {
    modules += `${mod.id} :[
      function(require, module, exports){
        ${mod.code}
      },
      ${JSON.stringify(mod.mapping)},
    ],`
  })

  let result = `
  (function(modules){
    function require(id){
      let [fn, mapping] = modules[id]

      function localRequire(name){
        return require(mapping[name])
      }

      let module = {exports: {}}
      fn(localRequire, module, module.exports)
      console.log('module.exports: ', module.exports)
      return module.exports
    }
    require(0)
  })({${modules}})`

  console.log('result after bundle: ', result)
  return result
}

function createDir (dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath)
  }
}

function writeFile (filePath, fileContent) {
  fs.writeFile(filePath, fileContent, (error) => {
    if (error) {
      console.log('An error occured: ', error)
    } else {
      console.log('write file success')
    }
  })
}


function main () {
  let entry = './static/entry.js'
  let graph = generateGraph(entry)
  let code = bundleGraph(graph)

  let dirPath = '../miniPack/build'
  createDir(dirPath)
  writeFile(dirPath + '/' + 'bundle.js', code)
}

main()


