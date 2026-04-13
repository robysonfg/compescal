// ==========================================
// CONFIGURAÇÃO DA API E VARIÁVEIS GLOBAIS
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbxNzsECDsawnLWMK6iWkeHs2gJMjt_lLEPP-fKZtGKE-nTxvXh9VlAWQKl7b0TatWds0g/exec"; // <--- ATENÇÃO: COLE SUA URL AQUI
let ultimoTotalPortaria = 0; 
let intervaloPortaria = null; 
let usuarioLogado = null;
let dadosGeraisRH = []; 
let direcaoAtual = ""; 

// ==========================================
// UTILIDADES
// ==========================================
function showToast(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    const icone = tipo === 'sucesso' ? 'ph-check-circle' : (tipo === 'erro' ? 'ph-warning-circle' : 'ph-info');
    toast.innerHTML = `<i class="ph ${icone}"></i> ${mensagem}`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

function dataHoraInputLocal() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function formatarISOparaBR(dataStr) {
    if (!dataStr) return "";
    try {
        if (String(dataStr).includes('/')) return dataStr; 
        const d = new Date(dataStr);
        if (isNaN(d.getTime())) return dataStr; 
        return d.toLocaleDateString('pt-BR') + ' ' + d.toTimeString().substring(0,5);
    } catch(e) { return dataStr; }
}

function extrairDataISO(dataBRouISO) {
    if (!dataBRouISO) return "";
    if (String(dataBRouISO).includes('T')) return String(dataBRouISO).split('T')[0];
    if (String(dataBRouISO).includes('/')) {
        const p = String(dataBRouISO).split(' ')[0].split('/');
        return `${p[2]}-${p[1]}-${p[0]}`;
    }
    return String(dataBRouISO);
}

function formatarDataSimplesBR(dataISO) {
    if(!dataISO) return "";
    if(dataISO.includes('/')) return dataISO;
    const p = dataISO.split('T')[0].split('-');
    if(p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    return dataISO;
}

window.toggleVisibilidade = function(idContainer, btnElement) {
    const el = document.getElementById(idContainer);
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        btnElement.innerHTML = '<i class="ph ph-minus"></i>';
    } else {
        el.classList.add('hidden');
        btnElement.innerHTML = '<i class="ph ph-plus"></i>';
    }
}

// ==========================================
// 1. SISTEMA DE LOGIN E PERFIS
// ==========================================
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Entrando...'; btn.disabled = true;
    
    const login = document.getElementById('login-user').value.trim();
    const senha = document.getElementById('login-senha').value;
    
    try {
        const res = await fetch(`${API_URL}?acao=login&login=${login}&senha=${senha}`);
        const data = await res.json();
        
        if (data.status === 'sucesso') {
            if (senha === '123456') {
                abrirTrocaDeSenha(login);
            } else {
                processarLogin(data.dados);
            }
        } else { showToast(data.mensagem, 'erro'); }
    } catch(e) { showToast("Erro de conexão.", "erro"); }
    
    btn.innerHTML = 'Entrar'; btn.disabled = false;
});

function processarLogin(dados) {
    usuarioLogado = dados;
    document.getElementById('user-name').textContent = usuarioLogado.nome;
    document.getElementById('view-login').classList.add('hidden');
    
    const perfis = usuarioLogado.perfil.split(',').map(p => p.trim().toUpperCase());
    
    if (perfis.length > 1) {
        document.getElementById('btn-trocar-perfil').classList.remove('hidden');
        abrirSelecaoDePerfil(perfis);
    } else {
        document.getElementById('btn-trocar-perfil').classList.add('hidden');
        document.getElementById('view-app').classList.remove('hidden');
        direcionarTela(perfis[0]);
    }
}

function abrirTrocaDeSenha(loginUser) {
    document.getElementById('modal-nova-senha').classList.remove('hidden');
    
    document.getElementById('form-nova-senha').onsubmit = async (e) => {
        e.preventDefault();
        const nova = document.getElementById('input-nova-senha').value;
        const confirma = document.getElementById('input-confirma-senha').value;
        
        if (nova !== confirma) return showToast("As senhas não são iguais!", "erro");
        if (nova === '123456') return showToast("A nova senha não pode ser 123456.", "erro");
        
        const btn = e.target.querySelector('button');
        const txtOrg = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;
        
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao: 'trocar_senha', login: loginUser, novaSenha: nova }) });
            const data = await res.json();
            if(data.status === 'sucesso') {
                showToast("Senha alterada! Faça o login novamente.", "sucesso");
                document.getElementById('modal-nova-senha').classList.add('hidden');
                document.getElementById('form-login').reset();
                document.getElementById('login-senha').focus();
            } else { showToast(data.mensagem, "erro"); }
        } catch(err) { showToast("Falha ao salvar.", "erro"); }
        
        btn.innerHTML = txtOrg; btn.disabled = false;
    };
}

function abrirSelecaoDePerfil(perfisDisponiveis) {
    const box = document.getElementById('botoes-perfis');
    box.innerHTML = '';
    
    const config = { 
        'LIDER': { icon: 'ph-users', bg: 'var(--grad-primary)', desc: 'Gestão de Lançamentos e Histórico' }, 
        'PORTARIA': { icon: 'ph-door-open', bg: 'var(--grad-accent)', desc: 'Controle de Acessos Físicos (Cancela)' }, 
        'RH': { icon: 'ph-chart-pieSlice', bg: 'var(--grad-corp)', desc: 'Dashboards, Relatórios e Rankings globais' } 
    };
    
    perfisDisponiveis.forEach(p => {
        if(config[p]) {
            box.innerHTML += `
                <div class="profile-card" onclick="escolherPerfilEEntrar('${p}')" style="background: ${config[p].bg};">
                    <i class="ph ${config[p].icon}"></i>
                    <h3>Módulo ${p}</h3>
                    <p>${config[p].desc}</p>
                </div>
            `;
        }
    });
    document.getElementById('modal-selecao-perfil').classList.remove('hidden');
}

window.escolherPerfilEEntrar = function(perfilSelecionado) {
    document.getElementById('modal-selecao-perfil').classList.add('hidden');
    document.getElementById('view-app').classList.remove('hidden');
    direcionarTela(perfilSelecionado);
}

document.getElementById('btn-trocar-perfil').addEventListener('click', () => {
    abrirSelecaoDePerfil(usuarioLogado.perfil.split(',').map(p => p.trim().toUpperCase()));
});

function direcionarTela(perfil) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    if(perfil === 'LIDER') iniciarLider();
    else if(perfil === 'PORTARIA') iniciarPortaria();
    else if(perfil === 'RH') iniciarRH();
}

document.getElementById('btn-logout').addEventListener('click', () => {
    usuarioLogado = null; 
    document.getElementById('form-login').reset();
    document.getElementById('view-app').classList.add('hidden');
    document.getElementById('view-login').classList.remove('hidden');
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    if (intervaloPortaria) clearInterval(intervaloPortaria);
});

// ==========================================
// 2. TELA LÍDER E NOVOS MÓDULOS
// ==========================================
function carregarSaudacaoLider() {
    const frases = ["Um excelente dia de trabalho!", "Sua liderança faz a diferença hoje!", "A jornada para o sucesso começa com organização.", "Vamos para mais um dia produtivo!"];
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    document.getElementById('lider-greeting-name').innerHTML = `<strong>${saudacao}, ${usuarioLogado.nome.split(' ')[0]}!</strong>`;
    document.getElementById('lider-phrase').textContent = frases[Math.floor(Math.random() * frases.length)];
}

async function iniciarLider() {
    document.getElementById('tela-lider').classList.remove('hidden');
    carregarSaudacaoLider(); voltarSelecao();
    
    const hoje = new Date().toISOString().split('T')[0];
    if(document.getElementById('data-falta')) document.getElementById('data-falta').value = hoje;
    if(document.getElementById('data-ci')) document.getElementById('data-ci').value = hoje;

    if(document.getElementById('data-folga')) {
        flatpickr("#data-folga", {
            mode: "multiple",
            dateFormat: "Y-m-d", 
            altInput: true,      
            altFormat: "d/m/Y",  
            locale: "pt",
            defaultDate: [hoje]
        });
    }

    const selMotivo = document.getElementById('motivo-saida');
    if (selMotivo) {
        selMotivo.addEventListener('change', function() {
            const obs = document.getElementById('obs-saida');
            if (this.value === 'Outros') {
                obs.required = true;
                obs.placeholder = "Obrigatório detalhar o motivo 'Outros'";
                obs.style.border = "1px solid var(--accent)";
            } else {
                obs.required = false;
                obs.placeholder = "(Opcional)";
                obs.style.border = "1px solid var(--border)";
            }
        });
    }

    try {
        const res = await fetch(`${API_URL}?tabela=Motivos`);
        const json = await res.json();
        selMotivo.innerHTML = '<option value="">Selecione...</option>';
        if(json.dados) json.dados.forEach(m => selMotivo.innerHTML += `<option value="${m.Motivo}">${m.Motivo}</option>`);

        const resLanc = await fetch(`${API_URL}?tabela=Lancamentos`);
        const jsonLanc = await resLanc.json();
        dadosGeraisRH = jsonLanc.dados || [];
    } catch(e) { console.log(e); }
}

window.abrirHistoricoLider = function() {
    abrirTela('view-historico-lider');
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('filtro-hist-inicio').value = hoje;
    document.getElementById('filtro-hist-fim').value = hoje;
    document.getElementById('filtro-hist-mat').value = '';
    filtrarHistoricoLider(); 
}

window.filtrarHistoricoLider = async function() {
    const container = document.getElementById('painel-historico-lider');
    container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="ph ph-spinner ph-spin" style="font-size:2rem; color:var(--primary);"></i><br>Buscando dados da nuvem...</div>';
    
    try {
        const res = await fetch(`${API_URL}?tabela=Lancamentos`);
        const json = await res.json();
        dadosGeraisRH = json.dados || [];
    } catch(e) { showToast("Erro ao buscar histórico recente.", "erro"); }

    const dtIn = document.getElementById('filtro-hist-inicio').value;
    const dtFim = document.getElementById('filtro-hist-fim').value;
    const mat = document.getElementById('filtro-hist-mat').value;

    let dadosLider = dadosGeraisRH.filter(d => d.Lider === usuarioLogado.nome);

    if (dtIn || dtFim) {
        dadosLider = dadosLider.filter(d => {
            const dFmt = extrairDataISO(d.Data_Hora_Pedido || d.Data); 
            let ok = true;
            if (dtIn && dFmt < dtIn) ok = false;
            if (dtFim && dFmt > dtFim) ok = false;
            return ok;
        });
    }

    if (mat) {
        dadosLider = dadosLider.filter(d => String(d.Matricula) === String(mat));
    }

    let saidas = [], entradas = [], faltas = [], folgas = [], cis = [];

    dadosLider.forEach(d => {
        if (d.Motivo === 'Falta') faltas.push(d);
        else if (d.Motivo === 'Folga') folgas.push(d);
        else if (d.Motivo === 'CI') cis.push(d);
        else if (d.Direcao === 'Saída') saidas.push(d);
        else if (d.Direcao === 'Entrada') entradas.push(d);
    });

    function criarCardLider(titulo, icone, cor, lista) {
        if(lista.length === 0) return '';
        
        let html = `
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px; border-left: 5px solid var(--${cor});">
            <h4 style="color: var(--${cor}); border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 10px; font-size: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="ph ${icone}"></i> ${titulo}</span>
                <span style="background: var(--${cor}); color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem;">${lista.length} reg.</span>
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px; max-height: 250px; overflow-y: auto; padding-right: 5px;">`;
        
        lista.forEach(item => {
            const isFormRH = ['Falta', 'Folga', 'CI'].includes(item.Motivo);
            const dataEventoBr = isFormRH ? formatarISOparaBR(item.Previsao_Saida).split(' ')[0] : formatarISOparaBR(item.Data_Hora_Pedido || item.Data).split(' ')[0];
            const infoExtra = isFormRH ? item.Observacao : item.Motivo;
            
            // Impede a exibição de "Aguardando liberação" nas Faltas/Folgas/CI
            const statusExibicao = (isFormRH || item.Status === '-' || !item.Status) ? '' : `<div style="font-size:0.75rem; margin-top:4px;">Status Atual: <strong>${item.Status}</strong></div>`;

            html += `
                <div style="font-size: 0.85rem; background: var(--bg); padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                        <strong style="color:var(--primary);">${item.Nome} <span style="color:var(--text-light)">(${item.Matricula})</span></strong>
                        <span style="font-size:0.75rem; color:var(--text-light); font-weight:bold; background: white; padding:2px 6px; border-radius:4px; border:1px solid var(--border);">${dataEventoBr}</span>
                    </div>
                    <div style="color:var(--dark); margin-bottom: 3px;"><i class="ph ph-caret-right"></i> ${infoExtra || '-'}</div>
                    ${statusExibicao}
                </div>`;
        });
        html += `</div></div>`;
        return html;
    }

    let htmlFinal = 
        criarCardLider('Liberação de Saída', 'ph-sign-out', 'accent', saidas) +
        criarCardLider('Liberação de Entrada', 'ph-sign-in', 'primary', entradas) +
        criarCardLider('Lançamento de Falta', 'ph-user-minus', 'dark', faltas) +
        criarCardLider('Lançamento de Folga', 'ph-coffee', 'success', folgas) +
        criarCardLider('C.I. Comunicação', 'ph-file-text', 'warning', cis);

    if (!htmlFinal) {
        htmlFinal = '<div style="text-align:center; padding: 20px; color: var(--text-light);"><i class="ph ph-ghost" style="font-size:2rem; margin-bottom:10px;"></i><br>Nenhum lançamento encontrado para este filtro.</div>';
    }

    container.innerHTML = htmlFinal;
}

function verificaDuplicidade(matricula, data, tipoLancamento) {
    const dataVerificarISO = extrairDataISO(data); 
    const jaExiste = dadosGeraisRH.some(registro => {
        const dataRegistroISO = extrairDataISO(registro.Previsao_Saida || registro.Data_Hora_Pedido);
        return (
            String(registro.Matricula) === String(matricula) && 
            dataRegistroISO === dataVerificarISO && 
            registro.Motivo === tipoLancamento
        );
    });
    return jaExiste;
}

function configurarFormularioLider(idForm, tipoLancamento) {
    const form = document.getElementById(idForm);
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const sufixo = idForm.split('-')[1]; 
        const matRaw = document.getElementById(`mat-${sufixo}`).value;
        const dataInputRaw = document.getElementById(`data-${sufixo}`).value;
        const nomeRaw = document.getElementById(`nome-${sufixo}`).value;
        
        if(!nomeRaw || nomeRaw === 'Buscando...') return showToast("Aguarde ou faça a busca das matrículas primeiro.", "erro");

        const matriculasArray = matRaw.split(',').map(m => m.trim()).filter(m => m);
        const nomesArray = nomeRaw.split('/').map(n => n.trim()).filter(n => n);
        const datasArray = dataInputRaw.split(',').map(d => d.trim()).filter(d => d);

        const btn = form.querySelector('button[type="submit"]');
        const txtOrg = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Salvando...'; 
        btn.disabled = true;

        const observacao = document.getElementById(sufixo === 'falta' ? 'obs-falta' : (sufixo === 'folga' ? 'tipo-folga' : 'assunto-ci')).value;
        
        let salvos = 0;
        let erros = 0;

        for (let i = 0; i < matriculasArray.length; i++) {
            const matAtual = matriculasArray[i];
            const nomeAtual = nomesArray[i] || 'Nome não localizado';

            for (const dataAtual of datasArray) {
                if (verificaDuplicidade(matAtual, dataAtual, tipoLancamento)) {
                    showToast(`Atenção: Já existe ${tipoLancamento} para ${matAtual} na data ${formatarDataSimplesBR(dataAtual)}!`, 'erro');
                    erros++;
                    continue; 
                }
                
                // CORREÇÃO CRÍTICA DO STATUS: Envia o '-' na 11ª posição da Array para bloquear o status padrão de portaria
                const dados = [
                    formatarISOparaBR(dataHoraInputLocal()), // 0: Timestamp Pedido
                    matAtual,                                // 1: Matrícula
                    nomeAtual,                               // 2: Nome     
                    tipoLancamento,                          // 3: Motivo
                    usuarioLogado.nome,                      // 4: Líder Logado
                    observacao,                              // 5: Observação
                    formatarDataSimplesBR(dataAtual),        // 6: Data do Evento Real
                    'Não',                                   // 7: Vai Retornar
                    '',                                      // 8: Previsão Retorno
                    'Lançamento RH',                         // 9: Direção
                    '-'                                      // 10: Status Fixo Invisível
                ];

                try {
                    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao: 'nova_autorizacao', dados: dados }) });
                    const dataRes = await res.json();
                    if(dataRes.status === 'sucesso') salvos++;
                    else { showToast(dataRes.mensagem, "erro"); erros++; }
                } catch(err) { showToast("Falha na conexão.", "erro"); erros++; }
            }
        }

        if (salvos > 0) {
            showToast(`${salvos} ${tipoLancamento}(s) salvo(s) com sucesso!`, 'sucesso'); 
            form.reset();
            
            const hoje = new Date().toISOString().split('T')[0];
            if (sufixo === 'folga' && document.getElementById('data-folga')._flatpickr) {
                document.getElementById('data-folga')._flatpickr.setDate(hoje);
            } else {
                document.getElementById(`data-${sufixo}`).value = hoje;
            }

            voltarParaMenu();
            iniciarLider(); 
        }

        btn.innerHTML = txtOrg; 
        btn.disabled = false;
    });
}

configurarFormularioLider('form-falta', 'Falta');
configurarFormularioLider('form-folga', 'Folga');
configurarFormularioLider('form-ci', 'CI');

window.abrirTela = function(idTela) {
    document.getElementById('selecao-direcao').classList.add('hidden');
    document.getElementById(idTela).classList.remove('hidden');
}

window.voltarParaMenu = function() {
    document.getElementById('view-falta').classList.add('hidden');
    document.getElementById('view-folga').classList.add('hidden');
    document.getElementById('view-ci').classList.add('hidden');
    document.getElementById('form-autorizacao-box').classList.add('hidden');
    document.getElementById('view-historico-lider').classList.add('hidden');
    document.getElementById('selecao-direcao').classList.remove('hidden');
}

// ------------------------------------------
// FORMULÁRIO ORIGINAL DE ENTRADA E SAÍDA
// ------------------------------------------
window.iniciarFormulario = function(tipo) {
    direcaoAtual = tipo;
    document.getElementById('selecao-direcao').classList.add('hidden');
    document.getElementById('form-autorizacao-box').classList.remove('hidden');
    document.getElementById('titulo-form').innerHTML = tipo === 'Saída' ? `<i class="ph ph-sign-out"></i> Autorizando Saída` : `<i class="ph ph-sign-in"></i> Autorizando Entrada`;
    document.getElementById('label-prev-acao').textContent = tipo === 'Saída' ? 'Prev. Saída' : 'Prev. Chegada';
    document.getElementById('prev-acao').value = dataHoraInputLocal();
    
    const obs = document.getElementById('obs-saida');
    obs.required = false; obs.placeholder = "(Opcional)"; obs.style.border = "1px solid var(--border)";
    const selMotivo = document.getElementById('motivo-saida');
    if(selMotivo) selMotivo.value = "";

    const boxRetorno = document.getElementById('box-vai-retornar');
    if(tipo === 'Entrada') { boxRetorno.classList.add('hidden'); document.getElementById('vai-retornar').value = 'Não'; } 
    else { boxRetorno.classList.remove('hidden'); }
    togglePrevisaoRetorno();
}

window.voltarSelecao = function() {
    document.getElementById('form-autorizacao').reset();
    document.getElementById('form-autorizacao-box').classList.add('hidden');
    document.getElementById('selecao-direcao').classList.remove('hidden');
}

window.togglePrevisaoRetorno = function() {
    const select = document.getElementById('vai-retornar').value;
    const box = document.getElementById('box-prev-retorno'); const input = document.getElementById('prev-retorno');
    if(select === 'Sim' && direcaoAtual === 'Saída') { box.classList.remove('hidden'); input.required = true; input.value = dataHoraInputLocal(); } 
    else { box.classList.add('hidden'); input.required = false; input.value = ''; }
}

window.buscarColaborador = async function(idInputMatricula, idInputNome) {
    const matRaw = document.getElementById(idInputMatricula).value;
    if(!matRaw) return;
    
    const mats = matRaw.split(',').map(m => m.trim()).filter(m => m);
    
    const aviso = document.getElementById('aviso-mat');
    if(aviso) { aviso.textContent = "Buscando..."; aviso.classList.remove('hidden'); aviso.classList.replace('text-danger', 'text-light'); }
    
    const inputNome = document.getElementById(idInputNome);
    inputNome.value = 'Buscando...';
    
    let nomesValidos = [];
    let erros = [];

    await Promise.all(mats.map(async (mat) => {
        try {
            const res = await fetch(`${API_URL}?acao=buscar_colaborador&matricula=${mat}`);
            const data = await res.json();
            if(data.status === 'sucesso') { 
                nomesValidos.push(data.dados.nome);
            } else { 
                erros.push(mat);
            }
        } catch(e) { 
            erros.push(mat);
        }
    }));

    inputNome.value = nomesValidos.join(' / ');
    
    if(erros.length > 0) {
        showToast(`Matrículas não encontradas: ${erros.join(', ')}`, 'erro');
        if(aviso) { aviso.textContent = "Erro em algumas matrículas."; aviso.classList.replace('text-light', 'text-danger'); }
    } else {
        if(aviso) aviso.classList.add('hidden');
    }
}

document.getElementById('btn-buscar-mat').addEventListener('click', () => buscarColaborador('mat-colaborador', 'nome-colaborador'));
document.getElementById('mat-colaborador').addEventListener('blur', () => buscarColaborador('mat-colaborador', 'nome-colaborador'));

document.getElementById('form-autorizacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('nome-colaborador').value;
    if(!nome || nome === 'Buscando...') return showToast("Aguarde ou faça a busca da matrícula primeiro.", "erro");
    
    const btn = e.target.querySelector('button[type="submit"]');
    const txtOrg = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Autorizando...'; btn.disabled = true;
    
    // CORREÇÃO CRÍTICA: Envia o status explícito para garantir o funcionamento correto na portaria
    const dados = [
        formatarISOparaBR(dataHoraInputLocal()), 
        document.getElementById('mat-colaborador').value, nome, document.getElementById('motivo-saida').value,
        usuarioLogado.nome, document.getElementById('obs-saida').value,
        formatarISOparaBR(document.getElementById('prev-acao').value),
        document.getElementById('vai-retornar').value,
        formatarISOparaBR(document.getElementById('prev-retorno').value), 
        direcaoAtual,
        `Aguardando Liberação de ${direcaoAtual}` // Status Fixo
    ];

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao: 'nova_autorizacao', dados: dados }) });
        const data = await res.json();
        if(data.status === 'sucesso') { showToast("Autorização enviada!", "sucesso"); voltarSelecao(); } 
        else { showToast(data.mensagem, "erro"); }
    } catch(err) { showToast("Falha na conexão.", "erro"); }
    
    btn.innerHTML = txtOrg; btn.disabled = false;
});

// ==========================================
// 3. TELA PORTARIA E MODAL OTIMISTA
// ==========================================
let btnConfirmarOrigem;
let idAtendimentoOrigem;

function showConfirmModal(titulo, mensagem, acaoPortaria, idApp) {
    idAtendimentoOrigem = idApp;
    document.getElementById('modal-title').innerHTML = `<i class="ph ph-warning-circle"></i> ${titulo}`;
    document.getElementById('modal-message').textContent = mensagem;
    
    const timeBox = document.getElementById('modal-time-box');
    btnConfirmarOrigem = document.getElementById('btn-modal-confirm');
    
    if(acaoPortaria.includes('faltou') || acaoPortaria === 'nao_retornou') {
        timeBox.classList.add('hidden');
        btnConfirmarOrigem.textContent = "Confirmar Falta";
        btnConfirmarOrigem.className = "btn btn-dark";
    } else {
        timeBox.classList.remove('hidden');
        const label = document.getElementById('modal-time-label');
        label.textContent = acaoPortaria === 'saida' ? 'Horário Real da Saída:' : (acaoPortaria === 'entrada' ? 'Horário Real da Entrada:' : 'Horário Real do Retorno:');
        document.getElementById('modal-time-input').value = dataHoraInputLocal();
        btnConfirmarOrigem.textContent = "Confirmar";
        btnConfirmarOrigem.className = "btn btn-success";
    }
    
    document.getElementById('modal-confirmacao').classList.remove('hidden');
    return new Promise(resolve => resolveModal = resolve);
}

document.getElementById('btn-modal-cancel').addEventListener('click', () => {
    document.getElementById('modal-confirmacao').classList.add('hidden');
    resolveModal({ confirmado: false });
});

document.getElementById('btn-modal-confirm').addEventListener('click', () => {
    btnConfirmarOrigem.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processando...';
    btnConfirmarOrigem.disabled = true;
    
    const horario = document.getElementById('modal-time-input').value;
    document.getElementById('modal-confirmacao').classList.add('hidden');
    
    const cartao = document.getElementById(`card-${idAtendimentoOrigem}`);
    if(cartao) cartao.style.display = 'none';

    resolveModal({ confirmado: true, horaISO: horario });
    setTimeout(() => { btnConfirmarOrigem.disabled = false; }, 1000);
});

async function iniciarPortaria() {
    document.getElementById('tela-portaria').classList.remove('hidden');
    carregarPortaria();

    if (intervaloPortaria) clearInterval(intervaloPortaria);
    
    intervaloPortaria = setInterval(() => {
        if (!document.getElementById('tela-portaria').classList.contains('hidden')) {
            carregarPortaria(true); 
        }
    }, 15000); 
}

async function carregarPortaria(silencioso = false) {
    const listaSaida = document.getElementById('lista-portaria-saida');
    const listaEntrada = document.getElementById('lista-portaria-entrada');
    const listaRetorno = document.getElementById('lista-portaria-retorno');
    const listaHistorico = document.getElementById('lista-historico-portaria');
    
    if (!silencioso) {
        listaSaida.innerHTML = '<div style="text-align:center;"><i class="ph ph-spinner ph-spin" style="font-size:2rem;"></i></div>';
        listaEntrada.innerHTML = ''; listaRetorno.innerHTML = ''; listaHistorico.innerHTML = '';
    }
    
    try {
        const res = await fetch(`${API_URL}?tabela=Lancamentos`);
        const json = await res.json();
        const autorizacoes = json.dados || [];

        const pendentesPortaria = autorizacoes.filter(a => {
            if (a.Direcao === 'Lançamento RH' || ['Falta', 'Folga', 'CI'].includes(a.Motivo)) return false;
            return a.Status && a.Status.includes("Aguardando");
        });
        
        const totalAtual = pendentesPortaria.length; 
        
        if (totalAtual > ultimoTotalPortaria) {
            const audio = document.getElementById('som-campainha');
            if (audio) { audio.play().catch(e => console.log('Áudio bloqueado pelo navegador')); }
        }
        ultimoTotalPortaria = totalAtual;
        
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        let htmlSaida = '', htmlEntrada = '', htmlRetorno = '', htmlHistorico = '';

        autorizacoes.reverse().forEach(auth => {
            if (auth.Direcao === 'Lançamento RH' || ['Falta', 'Folga', 'CI'].includes(auth.Motivo)) {
                return; 
            }

            const ehEntrada = auth.Direcao === 'Entrada';
            const vaiRetornarTag = (!ehEntrada && auth.Vai_Retornar === 'Sim') ? `<span class="tag-sim">Requer Retorno</span>` : ((!ehEntrada) ? `<span class="tag-nao">Sem Retorno</span>` : '');
            
            const pAcaoBR = formatarISOparaBR(auth.Previsao_Saida);
            const pRetornoBR = formatarISOparaBR(auth.Previsao_Retorno);
            const acaoRealBR = formatarISOparaBR(auth.Data_Hora_Saida); 
            const retRealBR = formatarISOparaBR(auth.Data_Hora_Retorno); 

            const detalhesComuns = `
                <div class="details">
                    <div><strong>Matrícula:</strong> ${auth.Matricula}</div>
                    <div><strong>Motivo:</strong> ${auth.Motivo}</div>
                    <div><strong>Líder:</strong> ${auth.Lider}</div>
                    ${auth.Observacao ? `<div><strong>Obs:</strong> ${auth.Observacao}</div>` : ''}
                </div>
            `;

            if (auth.Status === "Aguardando Liberação de Saída" || auth.Status === "Aguardando Portaria") {
                htmlSaida += `<div class="auth-card" id="card-${auth.ID}" style="border-left-color: var(--accent);"><div style="display:flex; justify-content:space-between;"><div class="name">${auth.Nome}</div> ${vaiRetornarTag}</div>${detalhesComuns}<div class="details"><strong>Prev. Saída:</strong> <span class="text-danger">${pAcaoBR}</span></div><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'saida')" class="btn btn-danger mt-1"><i class="ph ph-sign-out"></i> Confirmar Saída</button></div>`;
            } 
            else if (auth.Status === "Aguardando Liberação de Entrada") {
                htmlEntrada += `<div class="auth-card" id="card-${auth.ID}" style="border-left-color: var(--primary);"><div class="name">${auth.Nome}</div>${detalhesComuns}<div class="details"><strong>Prev. Chegada:</strong> <span class="text-primary">${pAcaoBR}</span></div><div style="display:flex; gap:10px; margin-top:10px;"><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'entrada')" class="btn btn-primary" style="flex:2;"><i class="ph ph-sign-in"></i> Confirmar Entrada</button><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'faltou_entrada')" class="btn btn-dark" style="flex:1;"><i class="ph ph-x-circle"></i> Faltou</button></div></div>`;
            }
            else if (auth.Status === "Aguardando Retorno") {
                htmlRetorno += `<div class="auth-card" id="card-${auth.ID}" style="border-left-color: var(--warning);"><div class="name">${auth.Nome}</div>${detalhesComuns}<div class="details"><strong>Saiu às:</strong> ${acaoRealBR}</div><div class="details"><strong>Prev. Retorno:</strong> <span style="color:var(--warning); font-weight:bold;">${pRetornoBR}</span></div><div style="display:flex; gap:10px; margin-top:10px;"><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'retorno')" class="btn" style="flex:2; background-color: var(--warning); color: white;"><i class="ph ph-clock-counter-clockwise"></i> Confirmar Retorno</button><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'faltou_saida')" class="btn btn-dark" style="flex:1;"><i class="ph ph-x-circle"></i> Faltou</button></div></div>`;
            }
            else if ((auth.Status === "Concluído" || auth.Status === "Saída Confirmada" || auth.Status.includes("Faltou") || auth.Status === "Não Retornou") && (acaoRealBR.includes(dataHoje) || retRealBR.includes(dataHoje) || pAcaoBR.includes(dataHoje))) {
                let classeCor = ""; let icone = "";
                if(auth.Status.includes("Faltou") || auth.Status === "Não Retornou") { classeCor = "hist-falta"; icone = auth.Status; }
                else if (auth.Vai_Retornar === 'Sim' && retRealBR) { classeCor = "hist-retorno"; icone = "Retorno Concluído"; }
                else if (ehEntrada) { classeCor = "hist-entrada"; icone = "Entrada Concluída"; }
                else { classeCor = "hist-saida"; icone = "Saída Concluída"; }

                htmlHistorico += `<div class="auth-card ${classeCor}"><div style="display:flex; justify-content:space-between;"><div class="name">${auth.Nome}</div><span style="font-size:0.7rem; font-weight:bold; color:var(--text-light);">${icone}</span></div><div class="details" style="font-size:0.8rem;"><div>Líder: ${auth.Lider} | Motivo: ${auth.Motivo}</div><div><strong>${ehEntrada ? 'Entrou' : 'Saiu'}:</strong> ${acaoRealBR || pAcaoBR || '-'}</div>${auth.Vai_Retornar === 'Sim' ? `<div><strong>Retornou:</strong> <span style="${auth.Status.includes('Faltou') || auth.Status === 'Não Retornou' ? 'color:var(--accent); font-weight:bold;' : ''}">${retRealBR || '-'}</span></div>` : ''}</div></div>`;
            }
        });

        listaSaida.innerHTML = htmlSaida || '<p class="text-light">Ninguém aguardando saída.</p>';
        listaEntrada.innerHTML = htmlEntrada || '<p class="text-light">Ninguém aguardando entrada.</p>';
        listaRetorno.innerHTML = htmlRetorno || '<p class="text-light">Ninguém aguardando retorno.</p>';
        listaHistorico.innerHTML = htmlHistorico || '<p class="text-light">Histórico vazio hoje.</p>';
        
    } catch(e) { 
        if(!silencioso) listaSaida.innerHTML = '<p class="text-danger">Erro.</p>'; 
    }
}

window.acionarPortaria = async function(id, nome, acao) {
    const titulo = acao.includes('faltou') ? 'Faltou' : 'Liberar Acesso';
    let msg = `Registrar o acesso de ${nome}?`;
    if(acao === 'faltou_entrada') msg = `Confirmar que ${nome} NÃO compareceu para a Entrada?`;
    if(acao === 'faltou_saida') msg = `Confirmar que ${nome} NÃO retornou da Saída?`;
    
    const result = await showConfirmModal(titulo, msg, acao, id);
    if(!result.confirmado) return;
    
    const horaAjustadaBR = acao.includes('faltou') ? 'Faltou' : formatarISOparaBR(result.horaISO); 
    
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ acao: 'acao_portaria', id: id, tipoAcao: acao, hora: horaAjustadaBR })
        });
        const data = await res.json();
        
        if(data.status === 'sucesso') { 
            showToast("Sincronizado na Nuvem!", "sucesso"); 
            carregarPortaria();
        } else { 
            showToast(data.mensagem, "erro"); 
            const cartao = document.getElementById(`card-${id}`);
            if(cartao) cartao.style.display = 'flex';
        }
    } catch(e) { 
        showToast("Erro na internet. Cartão restaurado.", "erro"); 
        const cartao = document.getElementById(`card-${id}`);
        if(cartao) cartao.style.display = 'flex';
    }
}

// ==========================================
// 4. TELA RH (Dashboards e Filtros Avançados)
// ==========================================
async function iniciarRH() {
    document.getElementById('tela-rh').classList.remove('hidden');
    document.getElementById('card-dados-relatorio').classList.add('hidden');
    
    try {
        const res = await fetch(`${API_URL}?tabela=Lancamentos`);
        const json = await res.json();
        dadosGeraisRH = json.dados || [];
        
        gerarKPIsERanking(dadosGeraisRH);
        carregarNotificacoesHoje(dadosGeraisRH); 
        preencherOpcoesFiltros(dadosGeraisRH);
        
        document.getElementById('tipo-relatorio').value = 'geral';
        toggleFiltrosRH();
    } catch(e) { showToast("Erro no RH.", "erro"); }
}

function carregarNotificacoesHoje(dados) {
    const container = document.getElementById('painel-notificacoes-rh');
    if (!container) return;

    const hojeISO = new Date().toISOString().split('T')[0]; 
    let saidas = [], entradas = [], faltas = [], folgas = [], cis = [];

    dados.forEach(d => {
        const d1 = extrairDataISO(d.Data_Hora_Pedido);
        const d2 = extrairDataISO(d.Previsao_Saida);
        const d3 = extrairDataISO(d.Data_Hora_Saida);
        const d4 = extrairDataISO(d.Data); 
        
        if (d1 === hojeISO || d2 === hojeISO || d3 === hojeISO || d4 === hojeISO) {
            if (d.Motivo === 'Falta') faltas.push(d);
            else if (d.Motivo === 'Folga') folgas.push(d);
            else if (d.Motivo === 'CI') cis.push(d);
            else if (d.Direcao === 'Saída') saidas.push(d);
            else if (d.Direcao === 'Entrada') entradas.push(d);
        }
    });

    function criarCardNotificacao(titulo, icone, cor, lista) {
        let html = `
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px; border-top: 3px solid var(--${cor});">
            <h4 style="color: var(--${cor}); border-bottom: 1px solid var(--border); padding-bottom: 5px; margin-bottom: 10px; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="ph ${icone}"></i> ${titulo}</span>
                <span style="background: var(--${cor}); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${lista.length}</span>
            </h4>
            <div style="max-height: 180px; overflow-y: auto; font-size: 0.8rem; padding-right: 5px;">`;
        
        if (lista.length === 0) {
            html += `<p style="color: var(--text-light); text-align: center; padding: 10px 0;">Nenhum registro hoje.</p>`;
        } else {
            lista.forEach(item => {
                const isFormRH = ['Falta', 'Folga', 'CI'].includes(item.Motivo);
                const infoPrincipal = isFormRH ? item.Observacao : item.Motivo;
                const dataEvento = isFormRH ? formatarISOparaBR(item.Previsao_Saida).split(' ')[0] : '';
                
                const obsTag = (!isFormRH && item.Observacao) ? `<div style="font-size:0.75rem; color:var(--text-light); margin-top:4px; padding:4px 8px; background: rgba(0,0,0,0.03); border-radius:4px; border-left: 2px solid var(--${cor});"><i class="ph ph-chat-text"></i> <i>${item.Observacao}</i></div>` : '';
                const badgeData = isFormRH ? `<span style="float:right; font-size:0.7rem; background:var(--bg); padding:2px 6px; border-radius:4px; border:1px solid var(--border);">${dataEvento}</span>` : '';

                html += `
                <div style="padding: 8px 0; border-bottom: 1px dashed var(--border);">
                    <strong style="color: var(--primary);">${item.Nome}</strong> <span style="color: var(--text-light); font-size: 0.7rem;">(${item.Matricula})</span> ${badgeData}<br>
                    <span style="color: var(--text-light); font-size: 0.8rem;">Líder: ${item.Lider}</span><br>
                    <span style="color: var(--dark); font-weight: 500; font-size: 0.85rem;">${infoPrincipal || '-'}</span>
                    ${obsTag}
                </div>`;
            });
        }
        html += `</div></div>`;
        return html;
    }

    container.innerHTML = 
        criarCardNotificacao('Saídas', 'ph-sign-out', 'accent', saidas) +
        criarCardNotificacao('Entradas', 'ph-sign-in', 'primary', entradas) +
        criarCardNotificacao('Faltas', 'ph-user-minus', 'dark', faltas) +
        criarCardNotificacao('Folgas', 'ph-coffee', 'success', folgas) +
        criarCardNotificacao('C.I.s', 'ph-file-text', 'warning', cis);
}

function gerarKPIsERanking(dados) {
    const hojeISO = new Date().toISOString().split('T')[0]; 
    const mesAtualISO = hojeISO.substring(0,7); 
    
    let kpi = {
        hoje: { saida: 0, entrada: 0, falta: 0, folga: 0, ci: 0 },
        mes: { saida: 0, entrada: 0, falta: 0, folga: 0, ci: 0 }
    };
    
    let rankingSaidas = {};
    let rankingEntradas = {};

    dados.forEach(d => {
        const dataPedidoISO = extrairDataISO(d.Data_Hora_Pedido || d.Data);
        
        const isMes = dataPedidoISO.startsWith(mesAtualISO);
        
        const d1 = extrairDataISO(d.Data_Hora_Pedido);
        const d2 = extrairDataISO(d.Previsao_Saida);
        const d3 = extrairDataISO(d.Data_Hora_Saida);
        const d4 = extrairDataISO(d.Data);
        const isHoje = (d1 === hojeISO || d2 === hojeISO || d3 === hojeISO || d4 === hojeISO);
        
        let cat = '';
        if (d.Motivo === 'Falta') cat = 'falta';
        else if (d.Motivo === 'Folga') cat = 'folga';
        else if (d.Motivo === 'CI') cat = 'ci';
        else if (d.Direcao === 'Saída') cat = 'saida';
        else if (d.Direcao === 'Entrada') cat = 'entrada';

        if (cat) {
            if (isHoje) kpi.hoje[cat]++;
            if (isMes) kpi.mes[cat]++;
        }

        if(isMes) {
            const chaveColab = `${d.Matricula} - ${d.Nome}`;
            if(d.Direcao === 'Saída') rankingSaidas[chaveColab] = (rankingSaidas[chaveColab] || 0) + 1;
            else if(d.Direcao === 'Entrada') rankingEntradas[chaveColab] = (rankingEntradas[chaveColab] || 0) + 1;
        }
    });
    
    if(document.getElementById('kpi-hoje-saida')) {
        document.getElementById('kpi-hoje-saida').textContent = kpi.hoje.saida;
        document.getElementById('kpi-hoje-entrada').textContent = kpi.hoje.entrada;
        document.getElementById('kpi-hoje-falta').textContent = kpi.hoje.falta;
        document.getElementById('kpi-hoje-folga').textContent = kpi.hoje.folga;
        document.getElementById('kpi-hoje-ci').textContent = kpi.hoje.ci;

        document.getElementById('kpi-mes-saida').textContent = kpi.mes.saida;
        document.getElementById('kpi-mes-entrada').textContent = kpi.mes.entrada;
        document.getElementById('kpi-mes-falta').textContent = kpi.mes.falta;
        document.getElementById('kpi-mes-folga').textContent = kpi.mes.folga;
        document.getElementById('kpi-mes-ci').textContent = kpi.mes.ci;
    }
    
    const arraySaidas = Object.keys(rankingSaidas).map(key => { return { nome: key, total: rankingSaidas[key] }; });
    arraySaidas.sort((a, b) => b.total - a.total);
    const ulSaidas = document.getElementById('lista-ranking-saida'); 
    if(ulSaidas) {
        ulSaidas.innerHTML = '';
        const top10Saidas = arraySaidas.slice(0, 10); 
        if(top10Saidas.length === 0) { ulSaidas.innerHTML = '<li><span class="text-light">Nenhuma saída neste mês.</span></li>'; } 
        else { top10Saidas.forEach((item, index) => { ulSaidas.innerHTML += `<li><span><strong>${index + 1}º</strong> ${item.nome}</span><span class="badge-rank">${item.total} req.</span></li>`; }); }
    }

    const arrayEntradas = Object.keys(rankingEntradas).map(key => { return { nome: key, total: rankingEntradas[key] }; });
    arrayEntradas.sort((a, b) => b.total - a.total);
    const ulEntradas = document.getElementById('lista-ranking-entrada'); 
    if(ulEntradas) {
        ulEntradas.innerHTML = '';
        const top10Entradas = arrayEntradas.slice(0, 10); 
        if(top10Entradas.length === 0) { ulEntradas.innerHTML = '<li><span class="text-light">Nenhuma entrada neste mês.</span></li>'; } 
        else { top10Entradas.forEach((item, index) => { ulEntradas.innerHTML += `<li><span><strong>${index + 1}º</strong> ${item.nome}</span><span class="badge-rank" style="background:var(--primary);">${item.total} req.</span></li>`; }); }
    }
}

function preencherOpcoesFiltros(dados) {
    const lideres = [...new Set(dados.map(d => d.Lider).filter(l => l))];
    const motivos = [...new Set(dados.map(d => d.Motivo).filter(m => !['Falta', 'Folga', 'CI'].includes(m) && m))];
    const selLider = document.getElementById('filtro-lider-select'); selLider.innerHTML = '<option value="">Todos</option>';
    lideres.sort().forEach(l => selLider.innerHTML += `<option value="${l}">${l}</option>`);
    const selMotivo = document.getElementById('filtro-motivo-select'); selMotivo.innerHTML = '<option value="">Todos</option>';
    motivos.sort().forEach(m => selMotivo.innerHTML += `<option value="${m}">${m}</option>`);
}

window.toggleFiltrosRH = function() {
    const tipo = document.getElementById('tipo-relatorio').value;
    document.getElementById('box-filtro-lider').classList.add('hidden'); document.getElementById('box-filtro-colab').classList.add('hidden'); document.getElementById('box-filtro-motivo').classList.add('hidden');
    if(tipo === 'lider') document.getElementById('box-filtro-lider').classList.remove('hidden');
    if(tipo === 'colaborador') document.getElementById('box-filtro-colab').classList.remove('hidden');
    if(tipo === 'motivo') document.getElementById('box-filtro-motivo').classList.remove('hidden');
}

window.aplicarFiltrosRH = function() {
    const tipo = document.getElementById('tipo-relatorio').value;
    const dtIn = document.getElementById('filtro-data-inicio').value; const dtFim = document.getElementById('filtro-data-fim').value; 
    const btn = document.querySelector('.filter-group').nextElementSibling;
    const txtOrg = btn.innerHTML; btn.innerHTML = 'Filtrando...'; btn.disabled = true;

    document.getElementById('card-dados-relatorio').classList.remove('hidden');

    let dadosFiltrados = dadosGeraisRH.filter(d => {
        let ok = true;
        if (dtIn || dtFim) {
            const dFmt = extrairDataISO(d.Data_Hora_Pedido || d.Data);
            if (dtIn && dFmt < dtIn) ok = false;
            if (dtFim && dFmt > dtFim) ok = false;
        }
        return ok;
    });

    if (tipo === 'lider') {
        const val = document.getElementById('filtro-lider-select').value;
        if(val) dadosFiltrados = dadosFiltrados.filter(d => d.Lider === val);
    } 
    else if (tipo === 'colaborador') {
        const val = document.getElementById('filtro-colab-input').value.toLowerCase();
        if(val) dadosFiltrados = dadosFiltrados.filter(d => String(d.Matricula).toLowerCase().includes(val) || String(d.Nome).toLowerCase().includes(val));
    }
    else if (tipo === 'motivo') {
        const val = document.getElementById('filtro-motivo-select').value;
        if(val) dadosFiltrados = dadosFiltrados.filter(d => d.Motivo === val);
    }
    else if (tipo === 'Falta' || tipo === 'Folga' || tipo === 'CI') {
        dadosFiltrados = dadosFiltrados.filter(d => d.Motivo === tipo); 
    }
    else if (tipo === 'faltou_entrada') {
        dadosFiltrados = dadosFiltrados.filter(d => d.Status === 'Faltou - Entrada'); 
    }
    else if (tipo === 'faltou_saida') {
        dadosFiltrados = dadosFiltrados.filter(d => d.Status === 'Faltou - Saída' || d.Status === 'Não Retornou'); 
    }
    
    renderizarTabelaGeralRH(dadosFiltrados);
    
    btn.innerHTML = txtOrg; btn.disabled = false;
    showToast(`${dadosFiltrados.length} registros encontrados.`, 'info');
}

function renderizarTabelaGeralRH(dados) {
    const thead = document.getElementById('thead-relatorio'); const tbody = document.getElementById('tbody-relatorio');
    
    thead.innerHTML = `<tr><th>Registro</th><th>Data do Evento</th><th>Tipo</th><th>Matrícula</th><th>Colaborador</th><th>Motivo</th><th>Líder</th><th>Observação</th><th>Status</th><th>Liberação</th><th>Retorno</th></tr>`;
    tbody.innerHTML = '';
    
    if(dados.length === 0) return tbody.innerHTML = '<tr><td colspan="11" class="text-center">Nenhum dado encontrado.</td></tr>';
    
    dados.reverse().forEach(d => {
        let bClass = 'pend';
        if(d.Status === 'Concluído' || d.Status === 'Saída Confirmada') bClass = 'ok';
        if(d.Status === 'Aguardando Retorno') bClass = 'ret';
        if(d.Status.includes('Faltou') || d.Status === 'Não Retornou') bClass = 'falta';

        const isFormRH = ['Falta', 'Folga', 'CI'].includes(d.Motivo);
        const tipoDir = d.Direcao === 'Entrada' ? 'Entrada' : (d.Direcao === 'Lançamento RH' ? 'Reg. Interno' : 'Saída');
        
        const dataEvento = isFormRH ? formatarISOparaBR(d.Previsao_Saida).split(' ')[0] : '-';
        const statusExibicao = (isFormRH || d.Status === '-') ? '-' : `<span class="status-badge ${bClass}">${d.Status}</span>`;
        const libExibicao = isFormRH ? '-' : formatarISOparaBR(d.Data_Hora_Saida);
        const retExibicao = isFormRH ? '-' : formatarISOparaBR(d.Data_Hora_Retorno);

        tbody.innerHTML += `<tr>
            <td>${formatarISOparaBR(d.Data_Hora_Pedido)}</td>
            <td style="font-weight:bold; color:var(--primary);">${dataEvento}</td>
            <td><strong>${tipoDir}</strong></td>
            <td>${d.Matricula}</td>
            <td>${d.Nome}</td>
            <td>${d.Motivo}</td>
            <td>${d.Lider}</td>
            <td>${d.Observacao || '-'}</td>
            <td>${statusExibicao}</td>
            <td>${libExibicao}</td>
            <td style="${d.Status && (d.Status.includes('Faltou') || d.Status === 'Não Retornou') ? 'color:red; font-weight:bold;' : ''}">${retExibicao}</td>
        </tr>`;
    });
}

window.exportarExcel = function() {
    const tabela = document.getElementById('tabela-relatorio'); const workbook = XLSX.utils.table_to_book(tabela, {sheet: "Relatório"});
    XLSX.writeFile(workbook, "Relatorio_Compescal.xlsx");
}
window.exportarPDF = function() {
    const { jsPDF } = window.jspdf; const doc = new jsPDF('landscape');
    const titulo = document.getElementById('tipo-relatorio').options[document.getElementById('tipo-relatorio').selectedIndex].text;
    doc.setFontSize(16); doc.text(`Relatório Compescal: ${titulo}`, 14, 20);
    doc.autoTable({ html: '#tabela-relatorio', startY: 30, theme: 'striped', headStyles: { fillColor: [15, 44, 89] }, styles: { fontSize: 8 } });
    doc.save("Relatorio_Compescal.pdf");
}
