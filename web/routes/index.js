var express = require('express');
var path = require('path');


const axios = require('axios');

const { monitorDNS, extractDomain, monitorHttpRequest, resolve } = require('../utils/monitor.dns');
const { verificarCertificadosSslEmLote } = require('../utils/certificado.validation');
const hosts = require('../utils/hosts');

const geoip = require('geoip-lite');
const { sendBatch2LogStash } = require('../utils/elastic');
const { func } = require('prop-types');

const processamentoEmLote = require('../utils/processamento.fila');


var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});


router.get('/monitor', async function (req, res) {

  var arrHosts = hosts.split('\n').map(extractDomain);

  await monitorDNS(arrHosts);
  //await monitorDNS(webAddresses);
  res.json({ message: 'monitoramento em andamento...' });
});

router.get('/teste', async function (req, res) {

  let host = 'https://service.multisked.com.br';//[...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const domain = extractDomain(host);
  console.log(domain);

  var ip = await resolve(domain);
  const { ll, country } = geoip.lookup(ip);

  res.json({ 'data': ll });
});



/**
 * Executar o banco json antes: npm run db
 * http://localhost:3000/monitorHttp
 */
router.get('/getTrackScan', async function (req, res) {

  try {
    const response = await axios.get('http://localhost:3001/tracks');
    //const responseList = Array.from(response.data);
    const responseList = getUniqueListBy(response.data, 'url').sort((a, b) => (b.ts - a.ts));

    //console.log('last: ', responseList[0]);

    res.json({ 'data': responseList, 'len': responseList.length, 'last_run': new Date(responseList[0].ts).toLocaleString() });

  } catch (err) {
    console.error(err.message);
    res.json({ 'data': [], 'len:': [].length });
  }

  //await monitorDNS(webAddresses);

});


// http://localhost:3100/getTimeLine
router.get('/getTimeline', async function (req, res) {

  const dataset = await axios.get('http://localhost:3001/timeline');

  const arrData = dataset.data.sort((a, b) => (a.ts - b.ts));
  //console.log('len: ', arrData.length);

  const group = arrData.reduce((acc, value) => {

    let key = value.status;

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(value);

    return acc;
  }, {});

  const arr = [];

  Object.entries(group).forEach(f => {
    arr.push({
      'name':  f[0],
      'total': f[1].map(m => (m.total)).slice(-10),
      'date':  f[1].map(m => (formatDateJsonLocale(m.ts))).slice(-10)
    })
  });


  res.json({ 'data': arr, 'len': arr.length, 'last_run': new Date().toLocaleString() });

})

function formatDateJsonLocale(ts){
  const dt = new Date(ts); 
  return new Date(ts - (dt.getTimezoneOffset() * 60000)).toJSON();
}


/**
 * ATENCAO: funciona apenas com o npm run start (sem o dev)
 * Executar o banco json antes: npm run db
 * Obtem novas requisicoes a cada 2 min
 * http://localhost:3100/executeBatch
 */
router.get('/executeBatch', async function (req, res) {
  setInterval(async () => {
    executeHttpMonitor();
    //console.log('>>>', respBatch.length); 
    console.log('executando novo batch em ', new Date().toLocaleString());
  }, 5 * 60 * 1000);

  //executeHttpMonitor();
  //this.executeBatchValidSSL(); 
  //await monitorDNS(webAddresses);
  res.json({ 'message': 'Batch em processamento ...', 'len:': new Date().toLocaleString() });
});


async function addTimeline(arrReq) {

  console.log(arrReq[0]);
  //const dataset = await axios.get('http://localhost:3001/tracks');
  const arrData = arrReq.sort((a, b) => (b.ts - a.ts)).slice(0, 1000);

  const group = arrData.reduce((acc, value) => {
    let key = value.status;
    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(value);

    return acc
  }, {})

  const arr = [];

  const ts = new Date().getTime();

  Object.entries(group).forEach(f => {
    arr.push({
      'status': f[0],
      'total': f[1].length,
      'ts': ts
    })
  });

  await fetchPostV2('http://localhost:3001/timeline', arr);
  console.log('timeline cadastrada com sucesso');

};

async function realizarCadastro(url, objeto) {
  try {
    const response = await axios.post(url, objeto);
    //console.log('Objeto cadastrado:', response.status);
  } catch (error) {
    throw new Error(`Erro ao cadastrar objeto: ${error.message}`);
  }
}

async function executeBatch() {
  console.log('executando batch de carga de dados...');
  setInterval(async () => {
    executeHttpMonitor();
    //console.log('>>>', respBatch.length); 
  }, min * 60 * 1000);
}

async function fetchPostV2(url, listaObjetos) {
  for (let i = 0; i < listaObjetos.length; i++) {
    const objeto = listaObjetos[i];
    try {
      await axios.post(url, objeto);
      console.log('Objeto cadastrado:', objeto);
    } catch (error) {
      console.error('Erro ao cadastrar objeto:', error.message);
    }

    // Aguardar 1 segundo antes de prosseguir para o próximo cadastro
    await sleep(1000);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPost(url, arrObj) {
  try {
    //console.log('>>> ', arrObj);
    //const now = new Date().getTime();

    const resultados = await Promise.all(
      arrObj.map(async (obj) => {
        try {

          //adiciona o registro de log
          //obj.ts = now;

          const resposta = await axios.post(url, obj);
          await sleep(1000);
          //console.log(resposta.status);
          return {
            //url: url,
            //valido: certificado.valid,
            //diasRestantes: certificado.daysRemaining,
            //'url': url,
            'status': resposta.status,
          };

        } catch (erro) {
          console.error(`Erro ao processar a URL ${url}: `, erro.message);
          return erro.message;
        }
      })
    );

    // Filtrar e remover resultados nulos
    //const requestsValidos = resultados.filter((res) => res !== null);
    //console.log('validos: ', certificadosValidos.length);

    return resultados;

  } catch (erro) {
    console.error('Ocorreu um erro ao processar as URL:', erro.message);
    throw erro;
  }
}



router.get('/a', function (req, res, next) {
  console.log('dir: ', __dirname);
  //res.sendFile('admin/index.html', { title: 'Express' });
  //res.sendFile(path.join(__dirname+'/admin/index.html'));
  res.sendFile(path.join(__dirname + '/admin/index.html'));
  //__dirname : It will resolve to your project folder.
});



// http://localhost:3000/monitorHttp2Elastic
router.get('/monitorHttp2Elastic', async function (req, res) {

  let listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  setInterval(async () => {
    const responseList = await monitorHttpRequest(listHttp);
    const respBatch = await sendBatch2LogStash(responseList);

    console.log('>>>', respBatch.length);
  }, 60 * 1000);


  //await monitorDNS(webAddresses);
  res.json({ 'message': 'executando batch logstash', 'timeBatch:': '60s' });
});



//carga de dad
router.get('/graphLogTrack', async function (req, res) {

  //const listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const dataset = await axios.get('http://localhost:3001/tracks');
  //const arrData = Array.from(dataset.data);

  const arrData = getUniqueListBy(dataset.data, 'url').sort((a, b) => (b.ts - a.ts));

  console.log('last:', new Date(arrData[0].ts).toLocaleString());

  const hostsn = arrData.map((m, i) => ({
    'id': i,
    'label': m.url.split('/')[2],
    'status': m.status,
    'rt': m.tempoDeResposta,
    'url': m.url,
    'depends_on': [i, random(i, arrData.length - 1)]
  }))

  //console.log(arrData[0]);

  const nodes = [...hostsn].map((m, i) => ({
    'id': i,
    'label': m.label,
    'color': getNodeColor(m.status),
    'x': random(0, 180),
    'y': random(0, 100),
    'size': 1.5 + hostsn.map(m => (m.depends_on)).flatMap(f => (f)).filter(x => (x === m.id)).length
  }))

  const edges = hostsn.flatMap((m, y) => (
    m.depends_on.map((t) => ({
      id: random(0, 99999999),
      source: nodes[m.id].id,
      target: nodes[t].id,
      label: (m.status === 200 || m.status === 404) ? '' : '' + m.status,
      //size: 3,
      type: 'curve',
      count: m.depends_on.length,
      color: '#ccc' //getEdgeColor(m.rt)
    }))
  ));

  //const responseList = await monitorHttpRequest(listHttp);
  //await monitorDNS(webAddresses);
  res.json({ 'data': [{ 'nodes': nodes, 'edges': edges }], 'nodes:': nodes.length, 'edges': edges.length });
});



router.get('/graphTest', async function (req, res) {

  const listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const hostsn = listHttp.map((m, i) => ({
    'id': i,
    'label': m.split('/')[2],
    'url': m,
    'rt': +m.tempoDeResposta,
    'depends_on': [i, random(i, listHttp.length - 1)]
  }))

  const nodes = [...hostsn].map((m, i) => ({
    'id': i,
    'label': m.label,
    'x': random(0, 100),
    'y': random(0, 100),
    'size': 2 + hostsn.map(m => (m.depends_on)).flatMap(f => (f)).filter(x => (x === m.id)).length
  }))

  const edges = hostsn.flatMap(m => (
    m.depends_on.map((t, i) => ({
      id: random(0, 999999),
      source: nodes[m.id].id,
      target: nodes[t].id,
      color: '#ccc'//getEdgeColor(m.rt)
    }))
  ));

  //const responseList = await monitorHttpRequest(listHttp);
  //await monitorDNS(webAddresses);
  res.json({ 'data': [{ 'nodes': nodes, 'edges': edges }], 'nodes:': nodes.length, 'edges': edges.length });
});



function getNodeColor(status) {
  switch (status) {
    case 404:
      return 'red'
    case 200:
      return 'green'
    default:
      return 'orange';
  }
}

/**
 * Obtem a cor das ligacoes pelo tempo de resposta
 * das conexoes
 * @param {*} rt 
 * @returns 
 */
function getEdgeColor(rt) {
  if (rt === 0) {
    return 'gray';
  } else if (rt < 3000) {
    return 'green';
  } else if (rt < 10000) {
    return 'yellow';
  } else {
    return 'orange';
  }
}

function random(min, max) {
  return Math.ceil(Math.random() * (max - min) + min);
}

router.get('/listSslValid', async function (req, res) {

  const dataset = await axios.get('http://localhost:3001/validSsl');
  const arrData = Array.from(dataset.data);

  res.json(arrData);
});


// http://localhost:3001/getCards
router.get('/getCards', async function (req, res) {

  const dataset = await axios.get('http://localhost:3001/tracks');
  const arrData = getUniqueListBy(dataset.data, 'url').sort((a, b) => (b.ts - a.ts));

  const group = arrData.reduce((acc, value) => {
    let key = value.status;
    if (!acc[key]) {
      acc[key] = 0;
    }

    acc[key]++;
    return acc
  }, {})

  const arr = Object.entries(group).map(m => ({
    'status': m[0],
    'total': m[1],
  })).filter(f => (f.status != 0))


  res.json({ 'arrData': arr, 'last': new Date(arrData[0].ts).toLocaleString(), 'len': arrData.len });

});


// localhost
router.get('/getStatusHosts', async function (req, res) {

  const dataset = await axios.get('http://localhost:3001/tracks');
  const arrData = getUniqueListBy(dataset.data, 'url').sort((a, b) => (b.ts - a.ts));

  const arr = shuffle(arrData).map(m => ({
    'host': m.url,
    'msg': m.message,
    'status': m.status,
    'rt': m.tempoDeResposta + 'ms',
    'color': getStatusColor(m.status)
  })).slice(0, 20);
  //console.log(arrData[0]);



  res.json({ 'arrData': arr, 'last': new Date(arrData[0].ts).toLocaleString(), 'len': arrData.len });

});


function getStatusColor(status) {
  const dict = {};

  dict[200] = 'bg-success';
  dict[404] = 'bg-danger';
  dict[401] = 'bg-secondary';
  dict[500] = 'bg-warning';
  dict[403] = 'bg-info';
  dict[502] = 'bg-light';
  dict[503] = 'bg-dark';
  dict[400] = 'bg-primary';

  return dict[status];
}


// localhost:3100/getStatusPie
router.get('/getStatusPie', async function (req, res) {

  const dataset = await axios.get('http://localhost:3001/tracks');
  const arrData = getUniqueListBy(dataset.data, 'url').sort((a, b) => (b.ts - a.ts));

  const groupData = arrData.reduce((acc, value) => {
    let key = value.status;
    if (!acc[key]) {
      acc[key] = 0;
    }

    acc[key]++;
    return acc
  }, {});

  //console.log(groupData);


  const arr0 = Object.entries(groupData).map(m => ({
    'name': m[0],
    'value': m[1],
  })).filter(f => f.name != 0);

  res.json({ 'arrData': arr0, 'last': new Date(arrData[0].ts).toLocaleString() });
})

router.get('/getTestCards', async function (req, res) {

  const dataset = await axios.get('http://localhost:3001/tracks');

  //ordem descrescente
  const arrData = dataset.data.sort((a, b) => (a.ts - b.ts));

  //lote 0 é o mais atua
  const [lote1, lote0] = obterUltimosLotes(arrData, 404);

  //console.log("Parte 1:", lote0.length);
  //console.log("Parte 2:", lote1.length);

  const groupA = lote0.reduce((acc, value) => {
    let key = value.status;
    if (!acc[key]) {
      acc[key] = 0;
    }

    acc[key]++;
    return acc
  }, {})

  const groupB = lote1.reduce((acc, value) => {
    let key = value.status;
    if (!acc[key]) {
      acc[key] = 0;
    }

    acc[key]++;
    return acc
  }, {})


  const arr0 = Object.entries(groupA).map(m => ({
    'status': m[0],
    'total': m[1],
    'lote': 0
  }))

  const arr1 = Object.entries(groupB).map(m => ({
    'status': m[0],
    'total': m[1],
    'lote': 1
  }))

  //console.table(arr0);
  //console.log('-----');
  //console.table(arr1);


  const difPercentualList = arr0.map(m => {
    const f = arr1.find(obj => obj.status === m.status);
    if (f) {
      //console.log('tabela 1', f);
      const dif = m.total / f.total;
      const percentualDif = (dif - 1) * 100;
      return {
        'status': m.status,
        'total': m.total,
        'percent': percentualDif.toFixed(1).concat('%'),
        'situacao': (percentualDif < 0) ? 'Melhorou' : 'Piorou',
        'class': (percentualDif < 0) ? 'text-success' : 'text-danger'
      };
    }
  })

  /**
  const correspondencia = {};

  arr1.forEach(f => {
    correspondencia[f.codigo] = f;
  });

  arr0.forEach(f => {
    const objetoCorrespondente = correspondencia[f.codigo];
    if (objetoCorrespondente) {
      const diferenca = f.total - objetoCorrespondente.total;
      const percentualDiferenca = (diferenca / objetoCorrespondente.total) * 100;
      console.log(`Código ${f.status}: Diferença percentual ${percentualDiferenca}%`);
    }
  }); */
  res.json({ 'arrData': difPercentualList.filter(f => (f != null)), 'last': new Date(arrData[0].ts).toLocaleString(), 'len': arrData.length });

});



function persistTimeLine(arrData) {

  const groupData = arrData.reduce((acc, value) => {
    let key = value.status;
    if (!acc[key]) {
      acc[key] = 0;
    }

    acc[key]++;
    return acc
  }, {});

  //console.log(groupData);


  const arr0 = Object.entries(groupData).map(m => ({
    'name': m[0],
    'value': m[1],
    'ts': new Date().getTime()
  })).filter(f => f.name != 0);

  console.log('arr0', arr0)

}

// localhost:3100/getDisponibilidade
router.get('/getDisponibilidade', async function (req, res) {

  const dataset = await axios.get('http://localhost:3001/tracks');
  const arrData = dataset.data;

  const arrMap = arrData.map(m => ({
    host: m.url,
    status: m.status
  }));

  const arrDisp = shuffle(calcularDisponibilidade(arrMap)).slice(0, 20);

  //console.log(arrDisp[0]);

  res.json({ 'arrData': arrDisp, 'last': new Date(arrData[0].ts).toLocaleString(), 'len': arrDisp.length });

});

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// Criar uma função para calcular as estatísticas de disponibilidade
function calcularDisponibilidade(listaHosts) {
  const estatisticasHosts = {};

  listaHosts.forEach(f => {
    const { host, status } = f;

    if (!estatisticasHosts[host]) {
      estatisticasHosts[host] = { sucesso: 0, total: 0 };
    }

    if (status === 200) {
      estatisticasHosts[host].sucesso++;
    }

    estatisticasHosts[host].total++;
  });

  const estatisticasDisponibilidade = [];

  Object.keys(estatisticasHosts).forEach((host, i) => {
    const { sucesso, total } = estatisticasHosts[host];
    const disponibilidade = (sucesso / total) * 100;

    estatisticasDisponibilidade.push({ 'i': i + 1, host, disponibilidade: disponibilidade.toFixed(1).concat('%') });
  });

  return estatisticasDisponibilidade;
}

function getUniqueListBy(arr, key) {
  return [...new Map(arr.map(item => [item[key], item])).values()]
}

//incluir em biblioteca utilitaria
function dividirArrayEmDuasPartes(array) {
  const tamanho = Math.ceil(array.length / 2);
  const primeiraParte = array.slice(0, tamanho);
  const segundaParte = array.slice(tamanho);
  return [primeiraParte, segundaParte];
}

function obterUltimosLotes(array, tamanhoDoLote) {
  const totalLotes = Math.ceil(array.length / tamanhoDoLote);
  const ultimoLote = array.slice(-tamanhoDoLote);
  const penultimoLote = array.slice(-tamanhoDoLote * 2, -tamanhoDoLote);
  return [penultimoLote, ultimoLote];
}



/**
 * Verifica o estado anterior e registra no banco as mudancas
 * @param {*} arr 
 */
async function executeActivities(arr) {
  //execucao de atividades diarias
  console.log('batch processado com sucesso!');
}

async function executeBatchValidSSL() {
  let hostsHttps = [...new Set(hosts.split('\n'))].filter(f => f.includes('https'));
  //if (!this.flagLoaded) return;
  const validArr = await verificarCertificadosSslEmLote(hostsHttps);

  fetchPost('http://localhost:3001/validSsl', validArr).then((s) => {
    console.log('executado com sucesso');
  })

  console.log('batch processado com sucesso!');
}





async function executeHttpMonitor() {

  let listHttp = [...new Set(hosts.split('\n'))].filter(f => f.includes('http'));

  const responseList = await monitorHttpRequest(listHttp);
  console.log('qtd de requests: ', responseList.length);
  await addTimeline(responseList);

  responseList.forEach((f, i) => {
    processamentoEmLote.adicionarObjeto(f);
  })

  //const filaCadastro = new ProcessamentoEmLote();

  //filaCadastro.adicionar({ nome: 'Objeto 1', valor: 10 });
  //filaCadastro.adicionar({ nome: 'Objeto 2', valor: 20 });
  //filaCadastro.adicionar({ nome: 'Objeto 3', valor: 30 });

  //const meuArray = Array.from({ length: 100 }, (_, index) => index + 1);

  //const processamento = new ProcessamentoEmLote();



  //processamentoEmLote.processar();

  /** responseList.forEach(f => {
    filaCadastro.adicionarObjeto(f);
  })**/
  //persistTimeLine(responseList);
  //cadastrarListaEmLote('http://localhost:3001/tracks', responseList);


  console.log('batch processado com sucesso!');
}


router.get('/testeProcessoGpt2', async function (req, res) {

  //var listArr = [];
  let hostsX = [...new Set(hosts.split('\n'))].filter(f => f.includes('https'));

  //console.log('lista len: ', hostsX.length);

  const arrSsl = await verificarCertificadosSslEmLote(hostsX);

  //await validateSslAsync3(webAddresses);
  //await monitorDNS(webAddresses);
  res.json({ message: arrSsl, processados: arrSsl.length });
});

const webAddresses = [
  'https://service.multisked.com.br',
  'https://eadsegen.mj.gov.br',
  'https://compras.dados.gov.br'
]

const dnsAddresses = [
  'service.multisked.com.br',
  'eadsegen.mj.gov.br',
  'compras.dados.gov.br'
];


module.exports = router;
