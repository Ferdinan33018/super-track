const dns = require('dns');
const http = require('https');
const async = require('async');
const geoip = require('geoip-lite');
const axios = require('axios');

const { verificarValidadeCertificado } = require('./certificado.validation');


module.exports = {
    // Função principal para monitorar todos os endereços de DNS
    monitorDNS: async function (dnsAddresses) {
        console.log('executando lista...', dnsAddresses.length);
        async.eachSeries(dnsAddresses, (address, next) => {
            checkDNS(address, next);
        }, (error) => {
            if (error) {
                console.error('Erro durante o monitoramento de DNS:', error);
            } else {
                console.log('Monitoramento de DNS concluído.');
            }
        });
    },

    monitorarRespostasHTTP: async function (urls) {
        try {
            for (const url of urls) {
                const resposta = await monitorarRequisicao(url);
                console.log(`URL: ${resposta.url}`);
                console.log(`Status: ${resposta.statusCode}`);
                console.log(`Tempo de resposta: ${resposta.responseTime}ms`);
                console.log('---');
            }
        } catch (error) {
            console.error('Erro na requisição:', error);
        }
    },


    monitorHttpRequest: async function (urls) {
        return verificarRequisicaoEmBatch(urls);
    },

    extractDomain: function (url) {
        return url2Domain(url);
    },

    resolve: function (url) {
        return resolveIp(url);
    }
}





async function monitorarRequisicao(url) {
    const startTime = process.hrtime();

    http.get(url, (res) => {
        const { statusCode } = res;
        const endTime = process.hrtime(startTime);
        const responseTime = endTime[0] * 1000 + endTime[1] / 1e6; // Tempo de resposta em milissegundos

        console.log(`URL: ${url}`);
        console.log(`Status: ${statusCode}`);
        console.log(`Tempo de resposta: ${Number(responseTime).toFixed(2)}ms`);

        res.resume();
    }).on('error', (error) => {
        console.error(`Erro na requisição para ${url}:`, error);
    });
}


// Função para realizar uma requisição HTTP e monitorar a resposta
function monitorarRequisicaoAsync(url) {
    const startTime = process.hrtime();

    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            const { statusCode } = res;
            const endTime = process.hrtime(startTime);
            const responseTime = endTime[0] * 1000 + endTime[1] / 1e6; // Tempo de resposta em milissegundos

            res.resume();

            resolve({
                url,
                statusCode,
                responseTime
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function verificarRequisicaoEmBatch(urls) {
    try {
        const resultados = await Promise.all(
            urls.map(async (url) => {
                try {
                    //const resposta = await axios.get(url);

                    const inicio = performance.now(); // Captura o tempo de início da requisição
                    const resposta = await axios.get(url);
                    const fim = performance.now(); // Captura o tempo de fim da requisição

                    const tempoDeResposta = fim - inicio; // Calcula o tempo de resposta em milissegundos

                    //console.log(resposta);
                    const ip = await resolveIp(url2Domain(url));

                    //console.log(resposta.status);
                    return {
                        //url: url,
                        //valido: certificado.valid,
                        //diasRestantes: certificado.daysRemaining,
                        //'host': resposta.host,
                        //'port': resposta.port,
                        //'location':  geoip.lookup(ip)?.ll,
                        'addr': ip,
                        'message': resposta.statusText,
                        'url': url,
                        'status': resposta.status,
                        'tempoDeResposta': `${+Number(tempoDeResposta).toFixed(2)}`,
                    };

                } catch (erro) {
                    //console.error(`Erro ao processar a URL ${url}: `, erro);
                    //const errorCode = erro.message.match(/\d{3}/);

                    return {
                        //url: url,
                        //valido: certificado.valid,
                        //diasRestantes: certificado.daysRemaining,
                        //'host': resposta.host,
                        //'port': erro.port,
                        //'location': null,
                        'addr': erro.address,
                        'message': erro.message,
                        'url': url,
                        'status': isNaN(erro.message.split(' ').pop()) ? 404 : +erro.message.split(' ').pop(), //(erro.code === 'ENOTFOUND') ? 404 : 504,//erro.message.match(/\d{3}/)[0],
                        'tempoDeResposta': 0,
                    };
                }
            })
        );

        // Filtrar e remover resultados nulos
        const requestsValidos = resultados.filter((res) => res !== null);
        //console.log('validos: ', certificadosValidos.length);

        return requestsValidos;

    } catch (erro) {
        console.error('Ocorreu um erro ao processar as URL:', erro.message);
        throw erro;
    }
}



function getTypeError(errorMsg){

    if(errorMsg.includes('ENOTFOUND')){
        
    }
    
}


// Função para verificar o status de um endereço de DNS
function checkDNS(addr, callback) {

    console.log('endereco: ', addr);
    address = url2Domain(addr);//.replace('https://', '');

    const startTime = process.hrtime();

    dns.resolve(address, (error, addresses) => {
        const endTime = process.hrtime(startTime);
        const responseTime = endTime[0] * 1000 + endTime[1] / 1e6; // Tempo de resposta em milissegundos

        if (error) {
            if (error.code === 'ENOTFOUND') {
                console.error(`DNS resolution for ${address} failed: Endereço não encontrado. Tempo de resposta: ${responseTime}ms`);
            } else if (error.code === 'ECONNREFUSED') {
                console.error(`DNS resolution for ${address} failed: Conexão recusada. Tempo de resposta: ${responseTime}ms`);
            } else {
                console.error(`DNS resolution for ${address} failed with error:`, error, `Tempo de resposta: ${responseTime}ms`);
            }
        } else {
            console.log(`DNS resolution for ${address} succeeded. IP addresses:`, addresses, `Tempo de resposta: ${responseTime}ms`);

            if (address.includes('https://')) {
                const resultado = verificarValidadeCertificado(address);
                console.log(`URL: ${resultado.url}`);
                console.log(`Certificado válido: ${resultado.valido}`);
                console.log(`Data de validade: ${resultado.validade}`);
                console.log('---');
            }
            //monitorarRequisicao(addr);
            // Obter informações de localização com base no endereço IP
            /** const location = geoip.lookup(addresses[0]);
            if (location) {
                console.log('Localização:', location.country, location.region, location.city, location.ll);
            } else {
                console.log('Localização: Desconhecida');
            }**/
        }
        callback();
    });
}


function url2Domain(addr) {
    return (addr.includes('http')) ? addr.split('//')[1].split('/')[0] : addr.split('/')[0];
}


async function resolveIp(url) {
    return new Promise((resolve, reject) => {
        dns.resolve(url, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res[0]);
            }
        });
    });
}