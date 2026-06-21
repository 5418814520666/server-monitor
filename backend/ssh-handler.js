/**
 * SSH 终端处理器
 * 处理 WebSocket SSH 连接
 */

const { Client } = require('ssh2');

/**
 * 处理 SSH 连接
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Object} config - SSH 配置
 */
function handleSSHConnection(ws, config) {
  const sshClient = new Client();
  let shellStream = null;
  let isConnected = false;

  // 发送消息到前端
  const sendMessage = (type, data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  };

  // 连接 SSH
  const connectSSH = (sshConfig) => {
    try {
      sshClient.on('ready', () => {
        isConnected = true;
        sendMessage('status', { connected: true, message: 'SSH 连接成功' });

        // 创建 shell 会话
        sshClient.shell({
          term: 'xterm-256color',
          cols: 80,
          rows: 24
        }, (err, stream) => {
          if (err) {
            sendMessage('error', { message: '创建 Shell 失败: ' + err.message });
            sshClient.end();
            return;
          }

          shellStream = stream;

          // 处理 SSH 输出
          stream.on('data', (data) => {
            sendMessage('output', data.toString());
          });

          // 处理 SSH 关闭
          stream.on('close', () => {
            sendMessage('status', { connected: false, message: 'SSH 连接已关闭' });
            sshClient.end();
          });

          // 处理 SSH 错误
          stream.on('error', (err) => {
            sendMessage('error', { message: 'Shell 错误: ' + err.message });
          });
        });
      });

      sshClient.on('error', (err) => {
        sendMessage('error', { message: 'SSH 连接错误: ' + err.message });
        isConnected = false;
      });

      sshClient.on('end', () => {
        isConnected = false;
        sendMessage('status', { connected: false, message: 'SSH 连接已断开' });
      });

      sshClient.on('close', () => {
        isConnected = false;
      });

      // 连接 SSH
      sshClient.connect({
        host: sshConfig.host,
        port: sshConfig.port || 22,
        username: sshConfig.username,
        password: sshConfig.password,
        privateKey: sshConfig.privateKey,
        passphrase: sshConfig.passphrase,
        readyTimeout: 20000
      });

    } catch (err) {
      sendMessage('error', { message: '连接失败: ' + err.message });
    }
  };

  // 调整终端大小
  const resizeTerminal = (cols, rows) => {
    if (shellStream && isConnected) {
      shellStream.setWindow(parseInt(rows), parseInt(cols));
    }
  };

  // 发送输入
  const sendInput = (data) => {
    if (shellStream && isConnected) {
      shellStream.write(data);
    }
  };

  // 处理 WebSocket 消息
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case 'connect':
          if (!isConnected) {
            connectSSH(msg.data);
          }
          break;

        case 'input':
          sendInput(msg.data);
          break;

        case 'resize':
          resizeTerminal(msg.data.cols, msg.data.rows);
          break;

        case 'disconnect':
          if (sshClient) {
            sshClient.end();
          }
          break;

        default:
          break;
      }
    } catch (err) {
      console.error('SSH WebSocket 消息解析错误:', err);
    }
  });

  // WebSocket 关闭
  ws.on('close', () => {
    if (sshClient) {
      sshClient.end();
    }
  });

  // WebSocket 错误
  ws.on('error', (err) => {
    console.error('SSH WebSocket 错误:', err);
    if (sshClient) {
      sshClient.end();
    }
  });
}

module.exports = { handleSSHConnection };
