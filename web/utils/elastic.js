'use strict';

const axios = require("axios");

module.exports = {
    sendBatch2LogStash: async function (objArr) {
        return enviarObjetosEmBatch(objArr)
    }
}

async function enviarObjetosEmBatch(arrObj) {
    try {
        const resultados = await Promise.all(
            arrObj.map(async (obj) => {
                try {

                    //console.log('>>>', obj);
                    //const resposta = await axios.get(url);

                    const inicio = performance.now(); // Captura o tempo de início da requisição
                    const response = await sendToElastic(obj);

                    //console.log('res: ', response);

                    const fim = performance.now(); // Captura o tempo de fim da requisição

                    const tempoDeResposta = fim - inicio; // Calcula o tempo de resposta em milissegundos

                    return {
                        'message': response.status,
                        'tempoDeResposta': `${+Number(tempoDeResposta).toFixed(2)}`,
                    };

                } catch (erro) {
                    //console.error(`Erro ao processar a URL ${url}: `, erro);
                    return {
                        'message': erro.message,
                        'tempoDeResposta': 0,
                    };
                }
            })
        );

        // Filtrar e remover resultados nulos
        //const requestsValidos = resultados.filter((res) => res !== null);
        //console.log('validos: ', certificadosValidos.length);

        return resultados;

    } catch (erro) {
        console.error('Ocorreu um erro ao processar as URL:', erro.message);
        //throw erro;
    }
}



async function sendToElastic(message) {

    //console.log('>> body: ', JSON.stringify(message));
    //var body = JSON.stringify(message)

    return axios.post('http://localhost:8082', message);

}



async function sendToElasticX(url, message) {

    //console.log(JSON.stringify(message));

    return await fetch(url, {
        method: "post",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },

        //make sure to serialize your JSON body
        body: JSON.stringify(message)

    }).then((response) => {
        //do something awesome that makes the world a better place
        return (response.statusText);
    }).catch(error => {
        console.log('error: ', error.message)
        return (error);
    });
}
