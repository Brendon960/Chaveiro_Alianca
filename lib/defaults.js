'use strict';
/**
 * Valores padrão do site. Tudo aqui pode ser alterado pelos painéis.
 * Regra de conteúdo: não inventar serviços, marcas, preços, equipamentos ou garantias.
 * Enquanto a empresa não confirmar, usar os espaços reservados entre colchetes.
 */

const PLACEHOLDERS = {
  price: '[PREÇO]',
  address: '[ENDEREÇO]',
  hours: '[HORÁRIO]',
  whatsapp: '[NÚMERO DO WHATSAPP]',
};

const DEFAULT_CATEGORIES = [
  { id: 'chaves', name: 'Chaves automotivas' },
  { id: 'controles', name: 'Controles' },
  { id: 'carcacas', name: 'Carcaças' },
  { id: 'laminas', name: 'Lâminas' },
  { id: 'acessorios', name: 'Acessórios' },
];

const DEFAULT_SETTINGS = {
  businessName: 'Chaveiro Aliança BH',
  logo: '',
  whatsapp: '',
  phone: '',
  email: '',
  address: PLACEHOLDERS.address,
  city: 'Belo Horizonte - MG',
  hours: PLACEHOLDERS.hours,
  mapsUrl: '',
  instagram: '',
  facebook: '',
};

const DEFAULT_TEXTS = {
  seoTitle: 'Chaveiro Aliança BH | Cópia de chave automotiva em Belo Horizonte',
  seoDescription:
    'Cópia de chave automotiva, codificação de chaves, programação de transponder e controles automotivos. Solicite seu orçamento pelo WhatsApp.',

  heroEyebrow: 'Especialistas em chaves automotivas',
  heroTitle: 'Precisa de uma cópia da chave do seu carro?',
  heroSubtitle:
    'Soluções em chaves automotivas, cópias, controles e programação. Entre em contato e solicite seu orçamento.',
  heroPrimaryButton: 'Solicitar orçamento pelo WhatsApp',
  heroSecondaryButton: 'Conhecer nossos serviços',
  heroImage: '/img/hero-chave-inteligente.svg',

  servicesEyebrow: 'Nossos serviços',
  servicesTitle: 'Soluções em chaves e controles automotivos',
  servicesSubtitle:
    'Informe a marca, o modelo e o ano do seu veículo e receba o orçamento do serviço indicado.',

  stepsTitle: 'Como solicitar seu orçamento',
  steps: [
    { title: 'Informe os dados do veículo', text: 'Envie marca, modelo e ano pelo WhatsApp.' },
    { title: 'Receba o orçamento', text: 'Avaliamos as informações e enviamos o orçamento do serviço.' },
    { title: 'Combine o atendimento', text: 'Com o orçamento aprovado, combinamos os detalhes do atendimento.' },
  ],

  quickEyebrow: 'Orçamento rápido',
  quickTitle: 'Monte sua mensagem e envie pelo WhatsApp',
  quickSubtitle:
    'Todos os campos são opcionais. Você pode revisar e editar a mensagem no WhatsApp antes de enviar.',

  differentialsTitle: 'Por que escolher o Chaveiro Aliança BH',
  differentials: [
    { title: 'Especialização automotiva', text: 'Atendimento focado em chaves e controles de veículos.' },
    { title: 'Tecnologia', text: 'Serviços de codificação e programação eletrônica de chaves.' },
    { title: 'Atendimento profissional', text: 'Orientação clara sobre o serviço indicado para o seu carro.' },
    { title: 'Segurança', text: 'Cuidado e responsabilidade no tratamento das chaves do seu veículo.' },
  ],

  catalogEyebrow: 'Catálogo',
  catalogTitle: 'Produtos e acessórios',
  catalogSubtitle: 'Chaves, controles, carcaças, lâminas e acessórios. Consulte disponibilidade e valores.',

  ctaTitle: 'Solicite seu orçamento agora',
  ctaText: 'Informe a marca, o modelo e o ano do seu veículo e o serviço desejado. O atendimento é feito pelo WhatsApp.',
  ctaButton: 'Solicitar orçamento pelo WhatsApp',

  contactEyebrow: 'Contato',
  contactTitle: 'Fale com o Chaveiro Aliança BH',
  contactSubtitle: 'Para orçamentos, o WhatsApp é o caminho mais rápido.',

  whatsappIntro: 'Olá! Gostaria de solicitar um orçamento para serviço de chave automotiva.',

  footerText: 'Soluções em chaves e controles automotivos.',
};

const DEFAULT_SERVICES = [
  {
    title: 'Cópia de chave automotiva',
    description:
      'Cópia da chave do seu veículo a partir da chave original. Informe marca, modelo e ano para receber o orçamento.',
    whatsappService: 'Cópia de chave automotiva',
    image: '/img/servicos/copia-chave.svg',
    highlight: true,
    active: true,
  },
  {
    title: 'Codificação de chaves',
    description: 'Codificação da chave para que ela seja reconhecida pelo sistema eletrônico do veículo.',
    whatsappService: 'Codificação de chave',
    image: '/img/servicos/codificacao.svg',
    highlight: false,
    active: true,
  },
  {
    title: 'Programação de transponder',
    description:
      'Programação do chip transponder da chave, necessário para a partida em veículos equipados com imobilizador.',
    whatsappService: 'Programação de transponder',
    image: '/img/servicos/transponder.svg',
    highlight: false,
    active: true,
  },
  {
    title: 'Controles automotivos',
    description: 'Controles remotos para travamento e destravamento do veículo, configurados para o seu carro.',
    whatsappService: 'Controle automotivo',
    image: '/img/servicos/controle.svg',
    highlight: false,
    active: true,
  },
  {
    title: 'Chaves presenciais',
    description:
      'Chaves por presença (aproximação) para veículos com partida sem chave. Consulte a compatibilidade do seu modelo.',
    whatsappService: 'Chave presencial',
    image: '/img/servicos/chave-presencial.svg',
    highlight: false,
    active: true,
  },
  // INATIVOS até a empresa confirmar que oferece.
  {
    title: 'Recuperação de chaves',
    description: 'Consulte as condições de atendimento para o seu veículo.',
    whatsappService: 'Recuperação de chave',
    image: '/img/servicos/recuperacao.svg',
    highlight: false,
    active: false,
  },
  {
    title: 'Abertura automotiva',
    description: 'Consulte as condições de atendimento para o seu veículo.',
    whatsappService: 'Abertura automotiva',
    image: '/img/servicos/abertura.svg',
    highlight: false,
    active: false,
  },
];

const DEFAULT_SYSTEM = {
  maintenance: false,
  maintenanceMessage:
    'Estamos realizando uma manutenção programada no site. Enquanto isso, fale com a gente pelo WhatsApp — o atendimento continua normalmente.',
  autoBackup: true,
  assetVersion: '1',
};

const DEFAULT_USERS = [
  { username: 'admin', role: 'admin', envPassword: 'ADMIN_PASSWORD', password: 'alianca2026' },
  { username: 'dev', role: 'developer', envPassword: 'DEV_PASSWORD', password: 'devalianca2026' },
];

module.exports = {
  PLACEHOLDERS,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  DEFAULT_TEXTS,
  DEFAULT_SERVICES,
  DEFAULT_SYSTEM,
  DEFAULT_USERS,
};
