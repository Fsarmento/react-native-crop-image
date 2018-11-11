// @flow
import React from 'react'
import { ImageEditor, StyleSheet, View, Animated, ImageStore } from 'react-native'
import { isTablet, isPhone, isIos, isAndroid } from 'react-native-device-detection'
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler'
import { withSafeArea } from 'react-native-safe-area'
import CameraSmallButton from './CameraSmallButton'
import { imgRetakeCamera60, imgCheck60 } from '../../../assets/images/pictos'
import { backgroundDark } from '../../../styles/colors'
import { removeFile } from '../../../api/filesystem'

const SafeAreaView = isPhone ? withSafeArea(View, 'absolutePosition', 'all') : View

type Props = {|
  image: string,
  retakePicture: Function,
  save: Function,
  imgWidth: number,
  imgHeight: number,
|}

type StateC = {|
  width: number,
  height: number,
|}

const MIN_MARGIN = 20
const MAX_SCALE = 5
const MIN_SCALE = 1

export default class PreviewAndCrop extends React.Component<Props, StateC> {
  panRef: any

  pinchRef: any

  _baseScale: Animated.Value

  _pinchScale: Animated.Value

  _scale: any

  _lastScale: number

  _onPinchGestureEvent: any

  _translateX: Animated.Value

  _translateY: Animated.Value

  _transX: any

  _transY: any

  _lastOffset: { x: number, y: number }

  _onPanGestureEvent: any

  constructor(props: Props) {
    super(props)

    this.state = {
      width: 0,
      height: 0,
    }

    /* Pinching */
    this._baseScale = new Animated.Value(1)
    this._pinchScale = new Animated.Value(1)
    this._scale = Animated.multiply(this._baseScale, this._pinchScale).interpolate({
      inputRange: [MIN_SCALE, MAX_SCALE],
      outputRange: [MIN_SCALE, MAX_SCALE],
      extrapolate: 'clamp',
    })
    this._lastScale = 1
    this._onPinchGestureEvent = Animated.event([{ nativeEvent: { scale: this._pinchScale } }], {
      useNativeDriver: true,
    })

    /* Pan */
    this._translateX = new Animated.Value(0)
    this._translateY = new Animated.Value(0)

    this._transX = Animated.divide(this._translateX, this._scale)
    this._transY = Animated.divide(this._translateY, this._scale)

    this._lastOffset = { x: 0, y: 0 }
    this._onPanGestureEvent = Animated.event(
      [
        {
          nativeEvent: {
            translationX: this._translateX,
            translationY: this._translateY,
          },
        },
      ],
      { useNativeDriver: true },
    )
  }

  componentWillUpdate(nextProps: Props, nextState: StateC) {
    const { width, height } = nextState
    const diameter = Math.min(width, height) - MIN_MARGIN

    const { imgWidth, imgHeight } = nextProps

    const rangeAnim = Animated.multiply(Animated.subtract(this._scale, 0.999), diameter / 2)

    let widthRangeAnim
    let heightRangeAnim
    if (imgWidth > imgHeight) {
      const delta = ((imgWidth / imgHeight) * diameter - diameter) / 2

      widthRangeAnim = Animated.add(Animated.multiply(delta, this._scale), rangeAnim)
      heightRangeAnim = rangeAnim
    } else {
      const delta = ((imgHeight / imgWidth) * diameter - diameter) / 2

      widthRangeAnim = rangeAnim
      heightRangeAnim = Animated.add(Animated.multiply(delta, this._scale), rangeAnim)
    }

    const limitY = this.normalizeAnim(this._translateY, heightRangeAnim)
    const limitX = this.normalizeAnim(this._translateX, widthRangeAnim)

    this._transY = Animated.divide(limitY, this._scale)
    this._transX = Animated.divide(limitX, this._scale)
  }

  normalizeAnim = (translate: any, rangeAnim: *): * => {
    const temp1 = Animated.add(translate, rangeAnim)
    const temp2 = Animated.divide(temp1, Animated.multiply(2, rangeAnim))

    const temp3 = temp2.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    })

    const temp4 = Animated.multiply(temp3, Animated.multiply(2, rangeAnim))
    const temp5 = Animated.subtract(temp4, rangeAnim)

    return temp5
  }

  _onPanGestureStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // this._lastOffset.x += event.nativeEvent.translationX

      console.log('scale ', this._lastScale)

      const { translationX, translationY } = event.nativeEvent

      console.log('position: ', { translationX, translationY })
      console.log('offset: ', this._lastOffset)

      this.setPositionOffsets(translationX, translationY)
    }
  }

  _onPinchHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      console.log('scale ', event.nativeEvent.scale)

      this._lastScale = Math.max(
        Math.min(this._lastScale * event.nativeEvent.scale, MAX_SCALE),
        MIN_SCALE,
      )

      console.log('scale min max ', this._lastScale)

      this._baseScale.setValue(this._lastScale)
      this._pinchScale.setValue(1)

      const { x, y } = this._lastOffset
      console.log('position: ', { x, y })

      this.setPositionOffsets(0, 0)
    }
  }

  setPositionOffsets = (positionX: number, positionY: number) => {
    const { width, height } = this.state
    const diameter = Math.min(width, height) - MIN_MARGIN

    const { imgWidth, imgHeight } = this.props

    const range = (diameter / 2) * (this._lastScale - 1)

    let widthRange
    let heightRange
    if (imgWidth > imgHeight) {
      const delta = ((imgWidth / imgHeight) * diameter - diameter) / 2
      widthRange = delta * this._lastScale + range
      heightRange = range
    } else {
      const delta = ((imgHeight / imgWidth) * diameter - diameter) / 2
      widthRange = range
      heightRange = delta * this._lastScale + range
    }

    this._lastOffset.x = Math.min(Math.max(this._lastOffset.x + positionX, -widthRange), widthRange)

    this._lastOffset.y = Math.min(
      Math.max(this._lastOffset.y + positionY, -heightRange),
      heightRange,
    )

    this._translateX.setOffset(this._lastOffset.x)
    this._translateX.setValue(0)
    this._translateY.setOffset(this._lastOffset.y)
    this._translateY.setValue(0)
  }

  _onLayout = (event) => {
    const { width, height } = event.nativeEvent.layout
    this.setState({ width, height })
  }

  save = () => {
    const { imgWidth, imgHeight } = this.props

    const { width, height } = this.state
    const diameter = Math.min(width, height) - MIN_MARGIN

    /** excedent in one of the shortest side */
    const range = (diameter / 2) * (this._lastScale - 1)

    let offset: { x: number, y: number }
    let size: { width: number, height: number }
    let widthRange
    let heightRange
    if (imgWidth > imgHeight) {
      const delta = ((imgWidth / imgHeight) * diameter - diameter) / 2
      widthRange = delta * this._lastScale + range
      heightRange = range

      offset = {
        x: ((widthRange - this._lastOffset.x) / this._lastScale / diameter) * imgHeight,
        y: ((heightRange - this._lastOffset.y) / this._lastScale / diameter) * imgHeight,
      }
      size = {
        width: imgHeight / this._lastScale,
        height: imgHeight / this._lastScale,
      }
    } else {
      const delta = ((imgHeight / imgWidth) * diameter - diameter) / 2
      widthRange = range
      heightRange = delta * this._lastScale + range

      offset = {
        x: ((widthRange - this._lastOffset.x) / this._lastScale / diameter) * imgWidth,
        y: ((heightRange - this._lastOffset.y) / this._lastScale / diameter) * imgWidth,
      }
      size = {
        width: imgWidth / this._lastScale,
        height: imgWidth / this._lastScale,
      }
    }

    const cropData = {
      offset,
      size,
      displaySize: {
        width: 900,
        height: 900,
      },
    }

    ImageEditor.cropImage(
      this.props.image,
      cropData,
      (uri) => {
        ImageStore.getBase64ForTag(
          uri,
          (base64) => {
            console.log('uri: ', uri)
            this.props.save(base64)
            isIos && ImageStore.removeImageForTag(uri)
            isAndroid && removeFile(uri)
          },
          () => {
            console.log('fail')
            isIos && ImageStore.removeImageForTag(uri)
            isAndroid && removeFile(uri)
          },
        )
      },
      () => console.log('FAIL'),
    )
  }

  render() {
    const { width, height } = this.state
    const diameter = Math.min(width, height) - MIN_MARGIN
    const diag = Math.sqrt(width * width + height * height) / 2
    const borderWidth = diag - diameter / 2

    const circleSize = {
      width: diameter + borderWidth * 2,
      height: diameter + borderWidth * 2,
      borderRadius: (diameter + borderWidth * 2) / 2,
      borderWidth,
    }

    const { imgWidth, imgHeight } = this.props

    let imgSize
    if (imgWidth > imgHeight) {
      imgSize = {
        width: (imgWidth / imgHeight) * diameter,
        height: diameter,
      }
    } else {
      imgSize = {
        width: diameter,
        height: (imgHeight / imgWidth) * diameter,
      }
    }

    return (
      <PanGestureHandler
        ref={this.panRef}
        // simultaneousHandlers={this.pinchRef}
        onGestureEvent={this._onPanGestureEvent}
        onHandlerStateChange={this._onPanGestureStateChange}
        minDist={10}
        minPointers={1}
        maxPointers={1}
        avgTouches
      >
        <Animated.View style={styles.wrapper}>
          <PinchGestureHandler
            ref={this.pinchRef}
            // simultaneousHandlers={this.panRef}
            onGestureEvent={this._onPinchGestureEvent}
            onHandlerStateChange={this._onPinchHandlerStateChange}
          >
            <Animated.View style={styles.container} collapsable={false} onLayout={this._onLayout}>
              <Animated.Image
                style={[
                  imgSize,
                  {
                    transform: [
                      { scale: this._scale },
                      { translateX: this._transX },
                      { translateY: this._transY },
                    ],
                  },
                ]}
                source={{ uri: this.props.image }}
              />

              <View style={[styles.circle, circleSize]} />
              <SafeAreaView style={styles.bottomMenu}>
                <CameraSmallButton source={imgRetakeCamera60} onPress={this.props.retakePicture} />
                <CameraSmallButton source={imgCheck60} onPress={this.save} />
              </SafeAreaView>
            </Animated.View>
          </PinchGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    overflow: 'hidden',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  wrapper: {
    flex: 1,
  },
  circle: {
    position: 'absolute',
    borderColor: backgroundDark,
  },
  bottomMenu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: isTablet ? 35 : 20,
    alignSelf: 'stretch',
  },
})
