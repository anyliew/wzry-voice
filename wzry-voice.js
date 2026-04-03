import fs from 'fs'
import path from 'path'

export class WzryVoicePlugin extends plugin {
  constructor () {
    super({
      name: 'Wzry Voice Plugin',
      dsc: '王者荣耀语音和图片回复',
      event: 'message',
      priority: 310,
      rule: [
        {
          reg: '^王者荣耀$',
          fnc: 'wzry'
        },
        {
          reg: '^王者$',
          fnc: 'wzry'
        }
      ]
    })
  }

  async wzry (e) {
    const triggerWord = e.msg
    logger.info(`[wzry-voice] 开始处理"${triggerWord}" - 三步发送`)

    try {
      // 第一步：发送固定语音 leige-001.mp3
      const fixedAudioPath = './plugins/wzry-voice/voice/leige-001.mp3'
      logger.info(`第一步：尝试发送固定语音 ${fixedAudioPath}`)
      if (fs.existsSync(fixedAudioPath)) {
        await e.reply(segment.record(fixedAudioPath))
        logger.info(`[wzry-voice] 固定语音发送成功: leige-001.mp3`)
      } else {
        logger.warn(`[wzry-voice] 固定语音文件不存在: ${fixedAudioPath}`)
        await e.reply('固定语音文件不存在')
      }

      // 第二步：从 voice/wzry/ 随机选取一个 mp3 发送
      const randomVoiceDir = './plugins/wzry-voice/voice/wzry'
      logger.info(`第二步：查找随机语音文件夹 ${randomVoiceDir}`)
      let randomAudioPath = null
      if (fs.existsSync(randomVoiceDir)) {
        const files = fs.readdirSync(randomVoiceDir)
        const mp3Files = files.filter(f => f.toLowerCase().endsWith('.mp3'))
        logger.info(`[wzry-voice] 找到 ${mp3Files.length} 个MP3文件`)
        if (mp3Files.length > 0) {
          const randIndex = Math.floor(Math.random() * mp3Files.length)
          const selected = mp3Files[randIndex]
          randomAudioPath = path.join(randomVoiceDir, selected)
          logger.info(`[wzry-voice] 随机选择音频: ${selected}`)
          if (fs.existsSync(randomAudioPath)) {
            await e.reply(segment.record(randomAudioPath))
            logger.info(`[wzry-voice] 随机语音发送成功: ${selected}`)
          } else {
            logger.warn(`[wzry-voice] 随机语音文件不存在: ${randomAudioPath}`)
          }
        } else {
          logger.warn('[wzry-voice] 随机语音文件夹中没有MP3文件')
          await e.reply('随机语音文件夹中没有MP3文件')
        }
      } else {
        logger.warn(`[wzry-voice] 随机语音文件夹不存在: ${randomVoiceDir}`)
        await e.reply('随机语音文件夹不存在')
      }

      // 第三步：从 images/wzry/ 随机选取一个 webp 发送
      const randomImageDir = './plugins/wzry-voice/images/wzry'
      logger.info(`第三步：查找随机图片文件夹 ${randomImageDir}`)
      let randomImagePath = null
      if (fs.existsSync(randomImageDir)) {
        const files = fs.readdirSync(randomImageDir)
        const webpFiles = files.filter(f => f.toLowerCase().endsWith('.webp'))
        logger.info(`[wzry-voice] 找到 ${webpFiles.length} 个WebP文件`)
        if (webpFiles.length > 0) {
          const randIndex = Math.floor(Math.random() * webpFiles.length)
          const selected = webpFiles[randIndex]
          randomImagePath = path.join(randomImageDir, selected)
          logger.info(`[wzry-voice] 随机选择图片: ${selected}`)
          if (fs.existsSync(randomImagePath)) {
            await e.reply(segment.image(randomImagePath))
            logger.info(`[wzry-voice] 随机图片发送成功: ${selected}`)
          } else {
            logger.warn(`[wzry-voice] 随机图片文件不存在: ${randomImagePath}`)
          }
        } else {
          logger.warn('[wzry-voice] 随机图片文件夹中没有WebP文件')
          await e.reply('随机图片文件夹中没有WebP文件')
        }
      } else {
        logger.warn(`[wzry-voice] 随机图片文件夹不存在: ${randomImageDir}`)
        await e.reply('随机图片文件夹不存在')
      }

      logger.info(`[wzry-voice] "${triggerWord}"三步处理完成`)
    } catch (error) {
      logger.error(`[wzry-voice] 处理"${triggerWord}"失败: ${error.message}`)
      logger.error(error.stack)
      await e.reply(`处理"${triggerWord}"失败: ` + error.message)
    }

    return true
  }
}